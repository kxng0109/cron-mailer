import { Injectable } from '@nestjs/common';
import { Pattern, Reminder as ReminderModel } from 'generated/prisma';
import { CreateReminderDto } from './dto/';
import { RemindersService } from './reminders.service';
import { ReminderScheduler } from './schedulers/reminder.scheduler';

@Injectable()
export class RemindersManagerService {
	constructor(
		private readonly remindersService: RemindersService,
		private readonly reminderScheduler: ReminderScheduler,
	) {}

	//Handle both creating of reminders and creating of cron jobs 
	//or timers for said reminders
	async createAndScheduleReminder(
		data: CreateReminderDto,
	): Promise<ReminderModel> {
		const reminder = await this.remindersService.createReminder(data);		
		if(reminder.pattern === Pattern.once){
			this.reminderScheduler.scheduleOneOff(reminder)
		}else{
			this.reminderScheduler.scheduleRecurring(reminder)
		}
		return reminder;
	}

	async cancelReminder(id: number){
		//Delete it first and return the reminder (if it exists)
		//It throws an error if it doesn't exists
		const reminder = await this.remindersService.cancelReminder({id});
		if(reminder.pattern === Pattern.once){
			this.reminderScheduler.deleteOneOff(reminder);
		}else{
			this.reminderScheduler.deleteRecurring(reminder)
		}
	}
}
