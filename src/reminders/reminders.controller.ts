import {
    Body,
    Controller,
    Delete,
    Get,
    HttpCode,
    HttpStatus,
    Param,
    ParseIntPipe,
    Post,
} from '@nestjs/common';
import { Pattern, Reminder as ReminderModel } from 'generated/prisma';
import { CreateReminderDto } from './dto/';
import { RemindersManagerService } from './reminders-manager.service';
import { RemindersService } from './reminders.service';
import { assertDefined, stripNulls } from './utils';

@Controller('reminders')
export class RemindersController {
	constructor(
		private readonly remindersService: RemindersService,
		private readonly remindersManagerService: RemindersManagerService,
	) {}

	@Post()
	async createReminder(
		@Body() createReminderDto: CreateReminderDto,
	): Promise<ReminderModel> {
		const reminder =
			await this.remindersManagerService.createAndScheduleReminder(
				createReminderDto,
			);
		return stripNulls(reminder);
	}

	@Get('/pending')
	async getFuturePendingReminders(): Promise<ReminderModel[]> {
		const pendingReminders = await this.remindersService.getPendingReminders();
		const reminders = pendingReminders.filter((reminder) => {
			if (reminder.pattern === Pattern.once) {
				assertDefined(reminder.sendAt);
				return reminder.sendAt > new Date();
			}
			return reminder;
		});
		return reminders.map((reminder) => stripNulls(reminder));
	}

	@HttpCode(HttpStatus.NO_CONTENT)
	@Delete(':id')
	async cancelReminder(@Param('id', ParseIntPipe) id: number) {
		return this.remindersManagerService.cancelReminder(id);
	}
}
