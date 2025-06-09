import { Test, TestingModule } from '@nestjs/testing';
import { CreateReminderDto } from './dto';
import { RemindersManagerService } from './reminders-manager.service';
import { RemindersService } from './reminders.service';
import { ReminderScheduler } from './schedulers/reminder.scheduler';

describe('RemindersManagerService', () => {
	let manager: RemindersManagerService;
	let mockRemindersService: Partial<RemindersService>;
	let mockScheduler: Partial<ReminderScheduler>;

	beforeEach(async () => {
		mockRemindersService = { createReminder: jest.fn() };
		mockScheduler = { scheduleRecurring: jest.fn(), scheduleOneOff: jest.fn() };

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				RemindersManagerService,
				{ provide: RemindersService, useValue: mockRemindersService },
				{ provide: ReminderScheduler, useValue: mockScheduler },
			],
		}).compile();

		manager = module.get(RemindersManagerService);
	});

	it('should persist then schedule a one-off reminder via ReminderScheduler.scheduleOneOff()', async () => {
		const dto = {
			email: 'x@x.com',
			message: 'hi',
			sendAt: new Date(Date.now() + 10000),
			pattern: 'once',
		} as CreateReminderDto;

		const created = { id: 1, ...dto };
		(mockRemindersService.createReminder as jest.Mock).mockResolvedValue(
			created,
		);

		await manager.createAndScheduleReminder(dto);

		expect(mockRemindersService.createReminder).toHaveBeenCalledWith(dto);
		expect(mockScheduler.scheduleOneOff).toHaveBeenCalledWith(created);
	});

	it('should persist then schedule a reminder every 10 minutes via ReminderScheduler.scheduleRecurring()', async () => {
		const dto = {
			email: 'x@x.com',
			message: 'hi',
			interval: 10,
			pattern: 'every_n_minutes',
		} as CreateReminderDto;

		const created = { id: 2, ...dto };
		(mockRemindersService.createReminder as jest.Mock).mockResolvedValue(
			created,
		);

		await manager.createAndScheduleReminder(dto);

		expect(mockRemindersService.createReminder).toHaveBeenCalledWith(dto);
		expect(mockScheduler.scheduleRecurring).toHaveBeenCalledWith(created);
	});

	it('should persist then schedule a daily reminder via ReminderScheduler.scheduleRecurring()', async () => {
		const dto = {
			email: 'x@x.com',
			message: 'hi',
			time: '12:30',
			pattern: 'daily',
		} as CreateReminderDto;

		const created = { id: 3, ...dto };
		(mockRemindersService.createReminder as jest.Mock).mockResolvedValue(
			created,
		);

		await manager.createAndScheduleReminder(dto);

		expect(mockRemindersService.createReminder).toHaveBeenCalledWith(dto);
		expect(mockScheduler.scheduleRecurring).toHaveBeenCalledWith(created);
	});

	it('should persist then schedule a monthly reminder via ReminderScheduler.scheduleRecurring()', async () => {
		const dto = {
			email: 'x@x.com',
			message: 'hi',
			time: '12:30',
			dayOfMonth: 9,
			pattern: 'monthly',
		} as CreateReminderDto;

		const created = { id: 4, ...dto };
		(mockRemindersService.createReminder as jest.Mock).mockResolvedValue(
			created,
		);

		await manager.createAndScheduleReminder(dto);

		expect(mockRemindersService.createReminder).toHaveBeenCalledWith(dto);
		expect(mockScheduler.scheduleRecurring).toHaveBeenCalledWith(created);
	});

	it('should persist then schedule a yearly reminder via ReminderScheduler.scheduleRecurring()', async () => {
		const dto = {
			email: 'x@x.com',
			message: 'hi',
			time: '12:30',
			dayOfMonth: 15,
			month: 5,
			pattern: 'monthly',
		} as CreateReminderDto;

		const created = { id: 4, ...dto };
		(mockRemindersService.createReminder as jest.Mock).mockResolvedValue(
			created,
		);

		await manager.createAndScheduleReminder(dto);

		expect(mockRemindersService.createReminder).toHaveBeenCalledWith(dto);
		expect(mockScheduler.scheduleRecurring).toHaveBeenCalledWith(created);
	});
});
