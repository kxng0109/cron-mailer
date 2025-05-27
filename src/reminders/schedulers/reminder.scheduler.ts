import {
	Injectable,
	InternalServerErrorException,
	Logger,
} from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import { Reminder as ReminderModel } from 'generated/prisma';
import { MailerService } from 'src/mailer/mailer.service';
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

	// @Cron(CronExpression.EVERY_10_SECONDS)
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

	createCron(givenDate: Date) {
		const date = givenDate.getDate();
		const month = givenDate.getMonth() + 1;
		const hour = givenDate.getHours();
		const minute = givenDate.getMinutes();
		const second = givenDate.getSeconds();
		const dayOfTheWeek = '*';
		let cronArray: any[] = [];
		[second, minute, hour, date, month, dayOfTheWeek].forEach((item) => {
			if (item || item == 0) {
				cronArray.push(item);
			} else {
				cronArray.push('*');
			}
		});
		return cronArray.join(' ');
	}

	logReminderCreation = (time: Date | string, emailID: number) => {
		this.logger.log(`Reminder set at ${time} for email with id: ${emailID}`);
	};

	async addCronJob(reminder: ReminderModel, cron: string) {
		const { id, email, message, subject, sendAt } = reminder;
		const name = id.toString();

		const job = new CronJob(cron, () => {
			this.handleSend(id, email, message, subject);
			this.schedulerRegistery.deleteCronJob(name);
		});

		this.schedulerRegistery.addCronJob(name, job);
		job.start();
		this.logReminderCreation(sendAt.toLocaleString(), id);
	}

	checkTimeout(name: string): boolean {
		try {
			this.schedulerRegistery.getTimeout(name);
			return true;
		} catch (err) {
			return false;
		}
	}

	addTimeout(reminder: ReminderModel) {
		const { id, email, message, subject, sendAt } = reminder;
		const timeoutName = `Reminder - ${id.toString()}`;

		//If the timeout exists, then don't create it.
		if (this.checkTimeout(timeoutName)) return;

		const delay = sendAt.getTime() - Date.now();
		if (delay <= 0) {
			return this.logger.error(
				`Timeout with id: ${id} could not be added. Time given is in the past.`,
			);
		}

		//Timeout logic
		const timeout = setTimeout(() => {
			this.handleSend(id, email, message, subject);
			this.schedulerRegistery.deleteTimeout(timeoutName);
		}, delay);
		this.schedulerRegistery.addTimeout(timeoutName, timeout);
		this.logReminderCreation(sendAt.toLocaleString(), id);
	}
}
