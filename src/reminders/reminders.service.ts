import { Injectable } from '@nestjs/common';
import { Prisma, Reminder } from 'generated/prisma';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class RemindersService {
	constructor(private readonly prismaService: PrismaService){}

	async createReminder(data: Prisma.ReminderCreateInput): Promise<Reminder>{
		return await this.prismaService.reminder.create({
			data
		})
	}
}
