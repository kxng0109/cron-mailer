import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Reminder } from 'generated/prisma';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class RemindersService {
	constructor(private readonly prismaService: PrismaService) {}

	async createReminder(data: Prisma.ReminderCreateInput): Promise<Reminder> {
		return await this.prismaService.reminder.create({
			data,
		});
	}

	async getPendingReminders(): Promise<Reminder[]> {
		return await this.prismaService.reminder.findMany({
			where: {
				status: 'pending',
			},
		});
	}

	private async getReminder(
		where: Prisma.ReminderWhereUniqueInput,
	): Promise<Reminder | null> {
		return await this.prismaService.reminder.findUnique({
			where,
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

	async cancelReminder(where: Prisma.ReminderWhereUniqueInput) {
		const reminder = await this.getReminder(where);
		if (!reminder) {
			throw new NotFoundException(`Reminder with id: ${where.id} not found`);
		}
		await this.prismaService.reminder.delete({
			where,
		});
		return reminder;
	}
}
