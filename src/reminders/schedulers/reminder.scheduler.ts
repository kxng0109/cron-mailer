import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { MailerService } from 'src/mailer/mailer.service';
import { RemindersService } from '../reminders.service';

@Injectable()
export class ReminderScheduler {
	private readonly logger = new Logger(ReminderScheduler.name);
	constructor(
		private readonly reminderService: RemindersService,
		private readonly mailerService: MailerService,
	) {}

	async handleSend(id: number, to: string, message, subject?: string) {
		const info = await this.mailerService.sendMail(to, message, subject);
		if (!info) return;
		const { rejected, messageId } = info;
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
		}
		
		this.logger.log(
			`Email with subject "${subject || 'no subject'}" sent to ${to} with id: ${messageId}`,
		);
		await this.reminderService.updateReminderStatus({
			data: { status: 'completed' },
			where: { id },
		});
	}

	@Cron(CronExpression.EVERY_10_SECONDS)
	async checkReminder() {
		const pendingReminders = await this.reminderService.getPendingReminders();
		if (!pendingReminders.length) {
			return this.logger.log('No pending reminders');
		}
		this.logger.log(`${pendingReminders.length || 0} pending reminders found.`);
		pendingReminders.forEach((reminder) => {
			const { sendAt, status, id, message, email } = reminder;
			const now = new Date();
			if (sendAt <= now && status !== 'completed') {
				this.handleSend(id, email, message);
			}
		});
	}
}
