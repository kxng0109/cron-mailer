import { Job } from 'bullmq';
import { RemindersConsumer } from './reminders.consumer';
import { ReminderScheduler } from './schedulers/reminder.scheduler';

describe('RemindersConsumer', () => {
	let consumer: RemindersConsumer;
	let mockRemindersService;
	let mockScheduler: Partial<ReminderScheduler>;

	beforeEach(() => {
		mockRemindersService = { getReminder: jest.fn() };
		mockScheduler = { handleSend: jest.fn() };
		consumer = new RemindersConsumer(
			mockRemindersService,
			mockScheduler as any,
		);
	});

	it('should call handleSend on pending reminder', async () => {
		const job = {
			data: {
				reminderId: 1,
				email: 'a@b.com',
				message: 'm',
				subject: 's',
				type: 'oneoff',
			},
		} as Job;
		mockRemindersService.getReminder.mockResolvedValue({
			id: 1,
			status: 'pending',
			email: 'a@b.com',
			message: 'm',
			subject: 's',
		});

		await consumer.process(job);

		expect(mockScheduler.handleSend).toHaveBeenCalledWith(
			1,
			'a@b.com',
			'm',
			's',
			'oneoff',
		);
	});

	it('should skip if reminder is completed', async () => {
		const job = {
			data: {
				reminderId: 2,
				email: '',
				message: '',
				subject: '',
				type: 'oneoff',
			},
		} as Job;
		mockRemindersService.getReminder.mockResolvedValue({
			id: 2,
			status: 'completed',
		});

		await consumer.process(job);
		expect(mockScheduler.handleSend).not.toHaveBeenCalled();
	});
});
