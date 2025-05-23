import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import * as Joi from 'joi';
import { MailerModule } from './mailer/mailer.module';
import { PrismaModule } from './prisma/prisma.module';
import { RemindersModule } from './reminders/reminders.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: Joi.object({
        MAIL_USERNAME: Joi.string().required(),
        MAIL_PASSWORD: Joi.string().required(),
        DATABASE_URL: Joi.string().required()
      }),
      validationOptions: {
        allowUnknown: false,
        abortEarly: true,
      },
    }),
    MailerModule,
    PrismaModule,
    RemindersModule,
  ],
})
export class AppModule {}
