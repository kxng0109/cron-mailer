import {
	ArrayMinSize,
	ArrayNotEmpty,
	IsArray,
	IsDate,
	IsDateString,
	IsEmail,
	IsEnum,
	IsInt,
	IsISO8601,
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

	@ValidateIf((o) => o.sendAt == null || o.pattern)
	@IsEnum(Pattern, {
		message: 'pattern must be one of the allowed enum values.',
	})
	@IsOptional()
	pattern?: Pattern = Pattern.once;

	@ValidateIf((o) => o.pattern === Pattern.once)
	@IsNotEmpty({ message: 'sendAt must be provided for one-off reminders' })
	@IsDate({ message: "sendAt must be a valid ISO date string with seconds"})
	@MinDate(() => new Date(), {
		message: 'Date for sendAt can not be less than current date.',
	})
	sendAt?: Date;

	@ValidateIf(
		(o) => o.pattern !== Pattern.once && o.pattern !== Pattern.every_n_minutes,
	)
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
	@Min(0, { each: true, message: "daysOfWeek must be between 0 and 6."})
	@Max(6, { each: true, message: "daysOfWeek must be between 0 and 6."})
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
