import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailerService {
	constructor(
		private readonly logger = new Logger(MailerService.name),
		private readonly configService: ConfigService,
	) {}

	private transporter() {
		return nodemailer.createTransport({
			service: 'gmail',
			host: 'smtp.gmail.com',
			port: '587',
			secure: false,
			auth: {
				user: this.configService.get<string>('MAIL_USERNAME'),
				password: this.configService.get<string>('MAIL_PASSWORD'),
			},
		});
	}

	async sendMail(from: string, to: string, subject: string, message: string) {
		try {
			const transporter = this.transporter();
			await transporter.verify();
			this.logger.log('Server is ready to send messages');
			const info = await transporter.sendMail({
				from,
				to,
				subject,
				text: message,
			});
			this.logger.log(`Email sent to ${to} with id: ${info.messageId}`);
		} catch (err) {
			this.logger.error(err);
			// throw err;
		}
	}
}
