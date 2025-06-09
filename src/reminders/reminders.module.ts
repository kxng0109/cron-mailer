import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { MailerModule } from 'src/mailer/mailer.module';
import { PrismaModule } from 'src/prisma/prisma.module';
import { ReminderBootstrapService } from './reminder-bootstrap.service';
import { RemindersManagerService } from './reminders-manager.service';
import { RemindersConsumer } from './reminders.consumer';
import { RemindersController } from './reminders.controller';
import { RemindersService } from './reminders.service';
import { ReminderScheduler } from './schedulers/reminder.scheduler';

@Module({
  imports: [
    PrismaModule,
    MailerModule,
    BullModule.registerQueue({ name: 'reminders' }),
  ],
  controllers: [RemindersController],
  providers: [
    RemindersService,
    ReminderScheduler,
    RemindersManagerService,
    ReminderBootstrapService,
    RemindersConsumer,
  ],
})
export class RemindersModule {}
