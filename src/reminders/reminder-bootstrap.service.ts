import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { ReminderScheduler } from './schedulers/reminder.scheduler';

@Injectable()
export class ReminderBootstrapService implements OnApplicationBootstrap {
	constructor(private readonly reminderScheduler: ReminderScheduler) {}
	onApplicationBootstrap() {
		this.reminderScheduler.checkReminder();
	}
}
