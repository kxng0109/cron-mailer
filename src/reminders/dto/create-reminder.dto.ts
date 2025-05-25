import {
    IsDate,
    IsEmail,
    IsNotEmpty,
    IsOptional,
    IsString,
    MinDate
} from 'class-validator';

export class CreateReminderDto {
	@IsEmail()
	@IsNotEmpty()
	email: string;

	@IsString()
	@IsOptional()
	message?: string;

	@IsDate()
	@MinDate(() => new Date(), {
		message: "Date for sendAt can not be less than current date.",
	})
	@IsNotEmpty()
	sendAt: Date;
}
