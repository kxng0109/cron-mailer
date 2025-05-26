import { Injectable } from '@nestjs/common';
import { Reminder as ReminderModel } from 'generated/prisma';
import { CreateReminderDto } from './dto/create-reminder.dto';
import { RemindersService } from './reminders.service';
import { ReminderScheduler } from './schedulers/reminder.scheduler';

@Injectable()
export class RemindersManagerService {
	constructor(
		private readonly remindersService: RemindersService,
		private readonly reminderScheduler: ReminderScheduler,
	) {}
	async createAndScheduleReminder(
		data: CreateReminderDto,
	): Promise<ReminderModel> {
		let reminder: ReminderModel;
		// if(data.sendAt){
		reminder = await this.remindersService.createReminder(data);
		// }
		this.reminderScheduler.addTimeout(reminder);
		return reminder;
	}
}
