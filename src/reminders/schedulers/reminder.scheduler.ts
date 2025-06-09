import { InjectQueue } from '@nestjs/bullmq';
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { Queue } from 'bullmq';
import { CronJob } from 'cron';
import { Pattern, Reminder as ReminderModel } from 'generated/prisma';
import { MailerService } from 'src/mailer/mailer.service';
import { MAX_TIMEOUT } from '../constants';
import { RemindersService } from '../reminders.service';
import { assertDefined } from '../utils';

@Injectable()
export class ReminderScheduler {
	private readonly logger = new Logger(ReminderScheduler.name);
	constructor(
		private readonly reminderService: RemindersService,
		private readonly mailerService: MailerService,
		private schedulerRegistery: SchedulerRegistry,
		@InjectQueue('reminders') private readonly remindersQueue: Queue,
	) {}

	addTimeout(delayMs: number, reminder: ReminderModel) {
		const { id, email, message, subject, sendAt, pattern } = reminder;
		const timeoutName = `reminder-timeout-${id.toString()}`;
		assertDefined(sendAt);

		//If the timeout exists, then don't create it.
		if (this.checkTimeout(timeoutName)) return;

		//Timeout logic
		const timeout = setTimeout(() => {
			this.handleSend(id, email, message, subject, 'oneoff');
			this.schedulerRegistery.deleteTimeout(timeoutName);
		}, delayMs);
		this.schedulerRegistery.addTimeout(timeoutName, timeout);
		this.logReminderCreation({
			mechanism: 'timeout',
			pattern,
			id,
			scheduledFor: sendAt,
			delayMs,
		});
	}

	addCronJob(
		reminder: ReminderModel,
		cron: string,
		type: 'recurring' | 'oneoff',
	) {
		const { id, email, message, subject, sendAt, pattern, time } = reminder;
		const name = `reminder-cron-${id}`;

		const job = new CronJob(cron, () => {
			this.handleSend(id, email, message, subject, 'recurring');
			if (type === 'oneoff') {
				this.schedulerRegistery.deleteCronJob(name);
			}
		});

		this.schedulerRegistery.addCronJob(name, job);
		job.start();
		if (sendAt) {
			this.logReminderCreation({
				mechanism: 'cron',
				pattern,
				id,
				scheduledFor: sendAt,
				cronExpression: cron,
			});
		} else {
			this.logReminderCreation({
				mechanism: 'cron',
				pattern,
				id,
				cronExpression: cron,
			});
		}
	}

	async addQueue(reminder: ReminderModel, delay: number) {
		const { id, sendAt, pattern, email, message, subject } = reminder;
		assertDefined(sendAt);
		await this.remindersQueue.add(
			'send-reminder',
			{ reminderId: id, email, message, subject, type: 'oneoff' },
			{ delay, attempts: 2 },
		);
		this.logReminderCreation({
			mechanism: 'queue',
			pattern,
			id,
			scheduledFor: sendAt,
			delayMs: delay,
		});
	}

	buildCronExpression(pattern: string, reminder: ReminderModel): string {
		const {
			sendAt: givenDate,
			dayOfMonth,
			daysOfWeek,
			interval,
			month,
			time,
		} = reminder;

		const newTime = time?.split(':').reverse().join(' '); //In the form "MM:HH"
		let cron: string;

		switch (pattern) {
			case Pattern.once:
				assertDefined(givenDate);
				const date = givenDate.getDate();
				const genMonth = givenDate.getMonth() + 1;
				const hour = givenDate.getHours();
				const minute = givenDate.getMinutes();
				const second = givenDate.getSeconds();
				const dayOfTheWeek = '*';
				cron = [second, minute, hour, date, genMonth, dayOfTheWeek]
					.map((item) => {
						item || item == 0 ? item : '*';
					})
					.join(' ');
				break;
			case Pattern.daily:
				assertDefined(time);
				cron = `${newTime} * * *`;
				break;
			case Pattern.hourly:
				assertDefined(newTime, 'time is not defined.');
				cron = `${newTime.slice(0, 2)} */1 * * *`;
				break;
			case Pattern.weekly:
				assertDefined(time);
				assertDefined(daysOfWeek);
				cron = `${newTime} * * ${daysOfWeek.toString()}`;
				break;
			case Pattern.every_n_minutes:
				if(!interval){
					assertDefined(newTime, 'time is not defined.');
					cron = `*/${newTime.slice(0, 2)} * * * *`;
				}
				cron = `*/${interval} * * * *`;
				break;
			case Pattern.monthly:
				assertDefined(time);
				cron = `${newTime} ${dayOfMonth} * *`;
				break;
			case Pattern.yearly:
				cron = `${newTime || '00:00'} ${dayOfMonth || '01'} ${month} *`;
				break;
			default:
				throw new BadRequestException('Pattern must be defined.');
		}
		return cron;
	}

	//Sets up pending reminders if any, when server starts
	async checkReminder() {
		const pendingReminders = await this.reminderService.getPendingReminders();
		if (!pendingReminders.length) {
			return this.logger.log('No pending reminders.');
		}

		this.logger.log(`${pendingReminders.length} pending reminders found.`);

		pendingReminders.forEach((reminder) => {
			//If it's not a one-off reminder, then schedule it as a recurring reminder
			if (reminder.pattern !== Pattern.once) {
				return this.scheduleRecurring(reminder);
			}

			//Anything after this, means that the reminder is one-off
			//sendAt has to be defined
			assertDefined(reminder.sendAt);
			const delayMs = reminder.sendAt.getTime() - Date.now();
			//If the reminder should've been sent, then send it now
			//else, schedule it as a one-off
			if (delayMs <= 0) {
				this.handlePastPendingReminders(reminder);
			} else {
				this.scheduleOneOff(reminder);
			}
		});
	}

	async handleSend(
		id: number,
		to: string,
		message: string | null,
		subject: string,
		type: 'recurring' | 'oneoff',
	): Promise<{ success: boolean; info: string; messageId: number }> {
		message = message || 'You have a reminder.';

		try {
			const info = await this.mailerService.sendMail(to, message, subject);
			const { accepted, rejected, messageId } = info;
			let processInfo: string;

			if (rejected.length) {
				processInfo = `Reminder ${id}: Email rejected by server to ${to}.`;
				this.logger.error(processInfo);
				await this.reminderService.updateReminderStatus({
					data: {
						status: 'failed',
					},
					where: { id },
				});
				throw new Error(processInfo);
			}

			if (accepted.length) {
				processInfo = `Reminder ${id}: Email sent to ${to} (messageId = ${messageId}). `;
				this.logger.log(processInfo);
				if (type === 'oneoff') {
					await this.reminderService.updateReminderStatus({
						data: { status: 'completed' },
						where: { id },
					});
				}
				return { success: true, info: processInfo, messageId: id };
			}

			processInfo = `handleSend(${id}): malformed sendMail response`;
			this.logger.error(processInfo);
			await this.reminderService.updateReminderStatus({
				where: { id },
				data: { status: 'failed' },
			});
			throw new Error(processInfo);
		} catch (err) {
			this.logger.error(`handleSend(${id}): sendMail threw`, err);
			await this.reminderService.updateReminderStatus({
				data: {
					status: 'failed',
				},
				where: { id },
			});
			throw err;
		}
	}

	deleteRecurring(reminder: ReminderModel) {
		this.schedulerRegistery.deleteCronJob(`reminder-cron-${reminder.id}`);
	}

	deleteOneOff(reminder: ReminderModel) {
		const timeoutName = `reminder-timeout-${reminder.id}`;
		this.checkTimeout(timeoutName) &&
			this.schedulerRegistery.deleteTimeout(timeoutName);
	}

	//Handles recurring reminders
	scheduleRecurring(reminder: ReminderModel) {
		const cron = this.buildCronExpression(reminder.pattern, reminder);
		this.addCronJob(reminder, cron, 'recurring');
	}

	//Handles one off reminders
	scheduleOneOff(reminder: ReminderModel) {
		const { sendAt, id } = reminder;
		assertDefined(sendAt);
		const delayMs = sendAt.getTime() - Date.now();

		switch (true) {
			case delayMs <= MAX_TIMEOUT && delayMs > 0:
				// this.addTimeout(delayMs, reminder);
				this.addQueue(reminder, delayMs);
				break;
			case delayMs > MAX_TIMEOUT:
				this.addQueue(reminder, delayMs);
				break;
			case delayMs <= 0:
				this.logger.error(
					`Reminder with id: ${id} could not be added. Time given is in the past.`,
				);
				break;
		}
	}

	//Checks if the timeout exists and return true if it does
	//returns false if an error is thrown
	private checkTimeout(name: string): boolean {
		try {
			this.schedulerRegistery.getTimeout(name);
			return true;
		} catch (err) {
			return false;
		}
	}

	//Handle reminders that are tagged "pending", but have not be executed
	private handlePastPendingReminders(reminder: ReminderModel) {
		const { id, message, email, subject } = reminder;
		this.handleSend(id, email, message, subject, 'oneoff');
	}

	private logReminderCreation = (args: {
		mechanism: 'timeout' | 'cron' | 'queue';
		pattern: string;
		id: number;
		scheduledFor?: Date;
		cronExpression?: string;
		delayMs?: number;
	}) => {
		const { mechanism, pattern, id, scheduledFor, cronExpression, delayMs } =
			args;
		const messageArray = [`ID=${id}`, `via=${mechanism}`, `pattern=${pattern}`];
		if (scheduledFor) {
			messageArray.push(`at=${scheduledFor.toLocaleString()}`);
		}
		if (cronExpression) {
			messageArray.push(`cron=${cronExpression}`);
		}
		if (delayMs) {
			messageArray.push(`delay=${delayMs}ms`);
		}
		this.logger.log(`Reminder scheduled - ${messageArray.join(' ')}`);
	};
}
