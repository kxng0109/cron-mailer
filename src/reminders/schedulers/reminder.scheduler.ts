import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
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
		this.logReminderCreation(sendAt.toLocaleString(), pattern, id);
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
		this.logReminderCreation(
			sendAt?.toLocaleString() || time || '',
			pattern,
			id,
		);
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
				assertDefined(newTime, 'time is not defined.');
				cron = `*/${interval || newTime.slice(0, 2)} * * * *`;
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
		message,
		subject: string,
		type: 'recurring' | 'oneoff',
	) {
		const info = await this.mailerService.sendMail(to, message, subject);
		if (!info)
			return this.logger.error(
				`An error occurred while sending mail with id: ${id}.`,
			);

		const { accepted, rejected, messageId } = info;
		if (rejected.length) {
			this.logger.error(
				`Email with address ${to} could not be sent because it was rejected by the server.`,
			);
			return await this.reminderService.updateReminderStatus({
				data: {
					status: 'failed',
				},
				where: { id },
			});
		} else if (accepted.length) {
			this.logger.log(
				`Email with subject: "${subject || 'no subject'}" sent to ${to} with id: ${messageId}.`,
			);
			if (type === 'oneoff') {
				await this.reminderService.updateReminderStatus({
					data: { status: 'completed' },
					where: { id },
				});
			}
		} else {
			this.logger.error(
				`An error occurred. Did not receive keys accepted and rejected for email with id: ${messageId}`,
			);
		}
	}

	logReminderCreation = (
		time: Date | string,
		pattern: string,
		emailID: number,
	) => {
		if (!time || time === '') {
			return this.logger.log(
				`Reminder set ${pattern} for email with id: ${emailID}`,
			);
		}
		this.logger.log(
			`Reminder set ${pattern} at ${time} for email with id: ${emailID}`,
		);
	};

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
		const { sendAt, id, pattern } = reminder;
		assertDefined(sendAt);
		const delayMs = sendAt.getTime() - Date.now();

		switch (true) {
			case delayMs <= MAX_TIMEOUT && delayMs > 0:
				this.addTimeout(delayMs, reminder);
				break;
			case delayMs > MAX_TIMEOUT:
				//Fix all this logic, it doesn't work.
				//You'll need to result to using bullmq or something similar
				const cron = this.buildCronExpression(pattern, reminder);
				this.addCronJob(reminder, cron, 'oneoff');
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
}
