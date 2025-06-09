import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { RemindersService } from './reminders.service';
import { ReminderScheduler } from './schedulers/reminder.scheduler';

@Processor('reminders')
export class RemindersConsumer extends WorkerHost {
	private logger = new Logger(RemindersConsumer.name);
	constructor(
		private readonly remindersService: RemindersService,
		private readonly reminderScheduler: ReminderScheduler,
	) {
		super();
	}

	async process(
		job: Job<{
			reminderId: number;
			email: string;
			message: string;
			subject: string;
			type: 'oneoff' | 'recurring';
		}>,
	) {
		const { reminderId, email, message, subject, type } = job.data;
		const reminder = await this.remindersService.getReminder({
			id: reminderId,
		});
		if (!reminder) {
			return this.logger.error(
				`Job ${job.id}: reminder ${reminderId} not found.`,
			);
		}

		const isCompleted = reminder.status === 'completed';
		if (isCompleted) {
			return this.logger.log(
				`Job ${job.id}: reminder ${reminderId} already completed; skipping.`,
			);
		}

		await this.reminderScheduler.handleSend(
			reminderId,
			email,
			message,
			subject,
			type,
		);
	}

	@OnWorkerEvent('failed')
	onFail(job: Job) {
		this.logger.error(
			`An error occurred while sending reminder with id: ${job.id}`,
		);
	}
}
