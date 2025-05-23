import { Body, Controller, Post } from '@nestjs/common';
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
}
