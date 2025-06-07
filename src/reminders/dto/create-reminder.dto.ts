import {
	ArrayMinSize,
	ArrayNotEmpty,
	IsArray,
	IsDate,
	IsDateString,
	IsEmail,
	IsEnum,
	IsIn,
	IsInt,
	IsNotEmpty,
	IsOptional,
	IsString,
	Matches,
	Max,
	Min,
	MinDate,
	ValidateIf,
} from 'class-validator';
import { Pattern } from 'generated/prisma';

export class CreateReminderDto {
	@IsEmail({}, { message: 'Must provide a valid email address.' })
	@IsNotEmpty()
	email: string;

	@IsString()
	@IsOptional()
	message?: string;

	@IsString()
	@IsOptional()
	subject?: string;

	@ValidateIf((o) => o.sendAt == null)
	@IsEnum(Pattern)
	pattern?: Pattern;

	@ValidateIf((o) => o.pattern === Pattern.once)
	@IsNotEmpty({ message: 'sendAt must be provided for one-off reminders' })
	@IsDateString({}, { message: 'sendAt must be a valid ISO date string' })
	@MinDate(() => new Date(), {
		message: 'Date for sendAt can not be less than current date.',
	})
	@IsNotEmpty()
	sendAt?: Date;

	@ValidateIf((o) => o.pattern !== Pattern.once)
	@IsNotEmpty()
	@Matches(/^(?:[01]\d|2[0-3]):[0-5]\d$/, {
		message: 'time must be in HH:mm (00:00–23:59) format.',
	})
	time?: string;

	@ValidateIf((o) => o.pattern === Pattern.every_n_minutes)
	@Min(1, { message: 'interval must be at least 1.' })
	@IsNotEmpty({
		message: 'interval is required when pattern = every_n_minutes.',
	})
	@IsInt()
	interval?: number;

	@ValidateIf((o) => o.pattern === Pattern.weekly)
	@IsArray({
		message:
			'daysOfWeek must be an array of numbers from 0-6 (Sunday-Saturday).',
	})
	@ArrayNotEmpty({
		message: 'daysOfWeek cannot be empty for weekly reminders.',
	})
	@ArrayMinSize(1, {
		message: 'At least a value for daysOfWeek is required.',
	})
	@Matches(/^[0-6]/, {
		each: true,
		message: 'Each dayOfWeek must be 0 (Sunday) through 6 (Saturday).',
	})
	daysOfWeek?: number[];

	@ValidateIf(
		(o) => o.pattern === Pattern.monthly || o.pattern === Pattern.yearly,
	)
	@Min(1, { message: 'dayOfMonth must be at least 1.' })
	@Max(31, { message: 'dayOfMonth must be at most 31.' })
	@IsNotEmpty({
		message: 'dayOfMonth is required for monthly/yearly reminders.',
	})
	dayOfMonth?: number;

	@ValidateIf((o) => o.pattern === Pattern.yearly)
	@Min(1, { message: 'month must be at least 1.' })
	@Max(12, { message: 'month must be at most 12.' })
	@IsNotEmpty({
		message: 'month is required for yearly reminders.',
	})
	month?: number;
}
