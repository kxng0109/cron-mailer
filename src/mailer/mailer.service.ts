import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailerService {
	private readonly logger = new Logger(MailerService.name);
	constructor(private readonly configService: ConfigService) {}

	private transporter() {
		return nodemailer.createTransport({
			service: 'gmail',
			host: 'smtp.gmail.com',
			port: 587,
			secure: false,
			auth: {
				user: this.configService.get<string>('MAIL_USERNAME'),
				pass: this.configService.get<string>('MAIL_PASSWORD'),
			},
		});
	}

	async sendMail(
		to: string,
		message: string,
		subject: string,
	) {
		try {
			const transporter = this.transporter();
			const info = await transporter.sendMail({
				from: this.configService.get<string>('MAIL_USERNAME'),
				to,
				subject,
				text: message,
			});

			this.logger.log(
				`Email with subject "${subject || 'no subject'}" sent to ${to} with id: ${info.messageId}`,
			);
			return info;
		} catch (err) {
			this.logger.error(err);
			// throw err;
		}
	}
}
