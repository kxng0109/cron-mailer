import { Injectable, Logger } from '@nestjs/common';
import { Prisma, Reminder } from 'generated/prisma';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class RemindersService {
	private readonly logger = new Logger(RemindersService.name);
	constructor(private readonly prismaService: PrismaService) {}

	async createReminder(data: Prisma.ReminderCreateInput): Promise<Reminder> {
		const reminder = await this.prismaService.reminder.create({
			data,
		});
		reminder && this.logger.log(`Reminder set for ${reminder.sendAt}.`);
		return reminder;
	}

	async getPendingReminders(): Promise<Reminder[]> {
		return await this.prismaService.reminder.findMany({
			where: {
				status: 'pending',
			},
		});
	}

	async updateReminderStatus(params: {
		data: Prisma.ReminderUpdateInput;
		where: Prisma.ReminderWhereUniqueInput;
	}): Promise<Reminder> {
		const { data, where } = params;
		return await this.prismaService.reminder.update({
			where,
			data,
		});
	}
}
