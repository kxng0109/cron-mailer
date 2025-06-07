import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import { Pattern, Reminder as ReminderModel } from 'generated/prisma';
import { MailerService } from 'src/mailer/mailer.service';
import { MAX_TIMEOUT } from '../constants';
import { RemindersService } from '../reminders.service';

@Injectable()
export class ReminderScheduler {
	private readonly logger = new Logger(ReminderScheduler.name);
	constructor(
		private readonly reminderService: RemindersService,
		private readonly mailerService: MailerService,
		private schedulerRegistery: SchedulerRegistry,
	) {}

	async handleSend(id: number, to: string, message, subject: string) {
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
				`Email with subject "${subject || 'no subject'}" sent to ${to} with id: ${messageId}`,
			);
			await this.reminderService.updateReminderStatus({
				data: { status: 'completed' },
				where: { id },
			});
		} else {
			this.logger.error(
				`An error occurred. Did not receive keys accepted and rejected for email with id: ${messageId}`,
			);
		}
	}

	async checkReminder() {
		const pendingReminders = await this.reminderService.getPendingReminders();
		if (!pendingReminders.length) {
			return this.logger.log('No pending reminders.');
		}

		this.logger.log(`${pendingReminders.length || 0} pending reminders found.`);

		const pendingFutureReminders = pendingReminders.filter(
			(reminder) => reminder.sendAt.getTime() - Date.now() > 0,
		);

		const pendingPastReminders = pendingReminders.filter(
			(reminder) => reminder.sendAt.getTime() - Date.now() <= 0,
		);

		pendingPastReminders.forEach((reminder) => {
			const { sendAt, status, id, message, email, subject } = reminder;
			const now = new Date();
			if (sendAt <= now && status !== 'completed') {
				this.handleSend(id, email, message, subject);
			}
		});

		pendingFutureReminders.forEach((reminder) => {
			this.addTimeout(reminder);
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
		if (!givenDate) throw new BadRequestException('sendAt is not defined.');
		if (!daysOfWeek)
			throw new BadRequestException('daysOfWeek is not defined.');

		let newTime = time?.split(':').reverse().join(' ');
		let cron: string;

		switch (pattern) {
			case Pattern.once:
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
				cron = `${newTime} * * *`;
				break;
			case Pattern.weekly:
				cron = `${newTime} * * ${daysOfWeek.toString()}`;
				break;
			case Pattern.every_n_minutes:
				cron = `*/${interval || newTime} * * * *`;
				break;
			case Pattern.monthly:
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

	//Handles recurring reminders
	scheduleRecurring(reminder: ReminderModel) {
		const cron = this.buildCronExpression(reminder.pattern, reminder);
		this.addCronJob(reminder, cron);
	}

	//Handles one off reminders
	scheduleOneOff(reminder: ReminderModel) {
		const { sendAt, id, pattern } = reminder;
		if (!sendAt) throw new BadRequestException('sendAt is not defined.');
		const delayMs = sendAt.getTime() - Date.now();

		switch (true) {
			case delayMs <= MAX_TIMEOUT && delayMs > 0:
				this.addTimeout(delayMs, reminder);
				break;
			case delayMs > MAX_TIMEOUT:
				const cron = this.buildCronExpression(pattern, reminder);
				this.addCronJob(reminder, cron);
				break;
			case delayMs <= 0:
				this.logger.error(
					`Reminder with id: ${id} could not be added. Time given is in the past.`,
				);
				break;
		}
	}

	addTimeout(delayMs: number, reminder: ReminderModel) {
		const { id, email, message, subject, sendAt, pattern } = reminder;
		const timeoutName = `reminder-timeout-${id.toString()}`;

		//If the timeout exists, then don't create it.
		if (this.checkTimeout(timeoutName)) return;

		//Timeout logic
		const timeout = setTimeout(() => {
			this.handleSend(id, email, message, subject);
			this.schedulerRegistery.deleteTimeout(timeoutName);
		}, delayMs);
		this.schedulerRegistery.addTimeout(timeoutName, timeout);
		this.logReminderCreation(sendAt.toLocaleString(), pattern, id);
	}

	async addCronJob(reminder: ReminderModel, cron: string) {
		const { id, email, message, subject, sendAt, pattern, time } = reminder;
		const name = `reminder-cron-${id}`;

		const job = new CronJob(cron, () => {
			this.handleSend(id, email, message, subject);
			this.schedulerRegistery.deleteCronJob(name);
		});

		this.schedulerRegistery.addCronJob(name, job);
		job.start();
		this.logReminderCreation(
			sendAt?.toLocaleString() || time || '',
			pattern,
			id,
		);
	}
}
