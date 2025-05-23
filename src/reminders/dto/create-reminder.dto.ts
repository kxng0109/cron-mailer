import { IsDate, IsEmail, IsNotEmpty, IsOptional, IsString } from "class-validator";

export class CreateReminderDto{
	@IsEmail()
	@IsNotEmpty()
	email: string;

	@IsString()
	@IsOptional()
	message?: string;

	@IsDate()
	@IsNotEmpty()
	sendAt: Date; 
}