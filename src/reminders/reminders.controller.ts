import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post } from '@nestjs/common';
import { Reminder as ReminderModel } from 'generated/prisma';
import { CreateReminderDto } from './dto/';
import { RemindersManagerService } from './reminders-manager.service';
import { RemindersService } from './reminders.service';

@Controller('reminders')
export class RemindersController {
  constructor(
    private readonly remindersService: RemindersService,
    private readonly remindersManagerService: RemindersManagerService,
  ) {}

  @Post()
  createReminder(
    @Body() createReminderDto: CreateReminderDto,
  ): Promise<ReminderModel> {
    return this.remindersManagerService.createAndScheduleReminder(
      createReminderDto,
    );
  }

  @Get('/pending')
  async getFuturePendingReminders(): Promise<ReminderModel[]> {
    const pendingReminders = await this.remindersService.getPendingReminders();
    return pendingReminders.filter((reminder) => reminder.sendAt > new Date());
  }

  @Delete(":id")
  async cancelReminder(@Param("id", ParseIntPipe) id: number){
    return this.remindersManagerService.cancelReminder(id);
  }
}
