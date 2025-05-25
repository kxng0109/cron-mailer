import { Body, Controller, Get, Post } from '@nestjs/common';
import { Reminder as ReminderModel } from 'generated/prisma';
import { CreateReminderDto } from './dto/create-reminder.dto';
import { RemindersService } from './reminders.service';

@Controller('reminders')
export class RemindersController {
  constructor(private readonly remindersService: RemindersService) {}

  @Post()
  createReminder(
    @Body() createReminderDto: CreateReminderDto,
  ): Promise<ReminderModel> {
    return this.remindersService.createReminder(createReminderDto);
  }

  @Get('/pending')
  async getFuturePendingReminders(): Promise<ReminderModel[]> {
    const pendingReminders = await this.remindersService.getPendingReminders();
    return pendingReminders.filter((reminder) => reminder.sendAt > new Date());
  }
}
