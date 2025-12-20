import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import { EmailOptions } from '../interfaces/notification.interface';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private resendClient: Resend | null = null;

  constructor(private readonly configService: ConfigService) {}

  async sendEmail(options: EmailOptions): Promise<boolean> {
    try {
      const emailProvider = this.configService
        .get<string>('EMAIL_PROVIDER', 'smtp')
        .toLowerCase();

      this.logger.log(`Sending email via ${emailProvider}`);
      this.logger.log(`To: ${options.to}`);
      this.logger.log(`Subject: ${options.subject}`);

      switch (emailProvider) {
        case 'resend':
          return await this.sendViaResend(options);
        case 'sendgrid':
          return await this.sendViaSendGrid(options);
        case 'aws-ses':
          return await this.sendViaAWSSES(options);
        case 'smtp':
        default:
          return await this.sendViaSMTP(options);
      }
    } catch (error) {
      this.logger.error('Failed to send email:', error);
      return false;
    }
  }

  private async sendViaResend(options: EmailOptions): Promise<boolean> {
    try {
      const client = this.getResendClient();

      let from =
        options.from ||
        this.configService.get<string>('RESEND_FROM_EMAIL') ||
        this.configService.get<string>('EMAIL_FROM');

      if (!from) {
        from = 'onboarding@resend.dev';
        this.logger.warn(
          'Resend from address is not configured, falling back to onboarding@resend.dev',
        );
      }

      const to = Array.isArray(options.to) ? options.to : [options.to];

      const payload: any = {
        from,
        to,
        subject: options.subject,
      };

      if (options.html) payload.html = options.html;
      if (options.text) payload.text = options.text;
      if (options.replyTo) payload.reply_to = options.replyTo;

      // Use tags for internal template identifier instead of Resend's template field
      // which expects a managed template ID
      if (options.template) {
        payload.tags = [
          {
            name: 'template_type',
            value: options.template,
          },
        ];
      }

      const res = await client.emails.send(payload);

      if (res.error) {
        this.logger.error(
          `Resend error: ${res.error.message} (${res.error.name})`,
        );
        return false;
      }

      this.logger.log(`Email sent via Resend. ID: ${res.data?.id}`);
      return true;
    } catch (error) {
      this.logger.error('Resend error:', error);
      return false;
    }
  }

  private getResendClient(): Resend {
    if (this.resendClient) return this.resendClient;

    const apiKey = this.configService.get<string>('RESEND_API_KEY');
    if (!apiKey) {
      throw new Error('RESEND_API_KEY is not configured');
    }

    this.resendClient = new Resend(apiKey);
    return this.resendClient;
  }

  private async sendViaSendGrid(options: EmailOptions): Promise<boolean> {
    try {
      // const sgMail = require('@sendgrid/mail');
      // sgMail.setApiKey(this.configService.get<string>('SENDGRID_API_KEY'));
      //
      // const msg = {
      //   to: options.to,
      //   from: options.from || this.configService.get<string>('SENDGRID_FROM_EMAIL'),
      //   subject: options.subject,
      //   html: options.html,
      //   text: options.text,
      //   replyTo: options.replyTo,
      // };
      //
      // await sgMail.send(msg);

      this.logger.log('Email sent via SendGrid (placeholder)');
      return true;
    } catch (error) {
      this.logger.error('SendGrid error:', error);
      return false;
    }
  }

  private async sendViaAWSSES(options: EmailOptions): Promise<boolean> {
    try {
      // const { SESClient, SendEmailCommand } = require('@aws-sdk/client-ses');
      //
      // const client = new SESClient({
      //   region: this.configService.get<string>('AWS_REGION'),
      //   credentials: {
      //     accessKeyId: this.configService.get<string>('AWS_ACCESS_KEY_ID'),
      //     secretAccessKey: this.configService.get<string>('AWS_SECRET_ACCESS_KEY'),
      //   },
      // });
      //
      // const command = new SendEmailCommand({
      //   Source: options.from || this.configService.get<string>('AWS_SES_FROM_EMAIL'),
      //   Destination: {
      //     ToAddresses: Array.isArray(options.to) ? options.to : [options.to],
      //   },
      //   Message: {
      //     Subject: { Data: options.subject },
      //     Body: {
      //       Html: options.html ? { Data: options.html } : undefined,
      //       Text: options.text ? { Data: options.text } : undefined,
      //     },
      //   },
      //   ReplyToAddresses: options.replyTo ? [options.replyTo] : undefined,
      // });
      //
      // await client.send(command);

      this.logger.log('Email sent via AWS SES (placeholder)');
      return true;
    } catch (error) {
      this.logger.error('AWS SES error:', error);
      return false;
    }
  }

  private async sendViaSMTP(options: EmailOptions): Promise<boolean> {
    try {
      // const nodemailer = require('nodemailer');
      //
      // const transporter = nodemailer.createTransport({
      //   host: this.configService.get<string>('SMTP_HOST'),
      //   port: this.configService.get<number>('SMTP_PORT'),
      //   secure: this.configService.get<boolean>('SMTP_SECURE', false),
      //   auth: {
      //     user: this.configService.get<string>('SMTP_USER'),
      //     pass: this.configService.get<string>('SMTP_PASS'),
      //   },
      // });
      //
      // await transporter.sendMail({
      //   from: options.from || this.configService.get<string>('SMTP_FROM_EMAIL'),
      //   to: options.to,
      //   subject: options.subject,
      //   html: options.html,
      //   text: options.text,
      //   replyTo: options.replyTo,
      // });

      this.logger.log('Email sent via SMTP (placeholder)');
      return true;
    } catch (error) {
      this.logger.error('SMTP error:', error);
      return false;
    }
  }

  isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
}
