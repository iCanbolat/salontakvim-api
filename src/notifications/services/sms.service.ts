import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SMSOptions } from '../interfaces/notification.interface';

@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);

  constructor(private readonly configService: ConfigService) {}

  /**
   * Send SMS using configured provider
   * This is a placeholder implementation
   * In production, integrate with Twilio or AWS SNS
   */
  async sendSMS(options: SMSOptions): Promise<boolean> {
    try {
      const smsProvider = this.configService.get<string>(
        'SMS_PROVIDER',
        'twilio',
      );

      this.logger.log(`Sending SMS via ${smsProvider}`);
      this.logger.log(`To: ${options.to}`);
      this.logger.log(`Message: ${options.message.substring(0, 50)}...`);

      // TODO: Implement actual SMS sending based on provider
      switch (smsProvider.toLowerCase()) {
        case 'twilio':
          return await this.sendViaTwilio(options);
        case 'aws-sns':
          return await this.sendViaAWSSNS(options);
        default:
          this.logger.warn(`Unknown SMS provider: ${smsProvider}`);
          return false;
      }
    } catch (error) {
      this.logger.error('Failed to send SMS:', error);
      return false;
    }
  }

  /**
   * Send SMS via Twilio
   * Install: pnpm add twilio
   */
  private async sendViaTwilio(options: SMSOptions): Promise<boolean> {
    try {
      // const twilio = require('twilio');
      //
      // const client = twilio(
      //   this.configService.get<string>('TWILIO_ACCOUNT_SID'),
      //   this.configService.get<string>('TWILIO_AUTH_TOKEN'),
      // );
      //
      // await client.messages.create({
      //   body: options.message,
      //   from: options.from || this.configService.get<string>('TWILIO_PHONE_NUMBER'),
      //   to: options.to,
      // });

      this.logger.log('SMS sent via Twilio (placeholder)');
      return true;
    } catch (error) {
      this.logger.error('Twilio error:', error);
      return false;
    }
  }

  /**
   * Send SMS via AWS SNS
   * Install: pnpm add @aws-sdk/client-sns
   */
  private async sendViaAWSSNS(options: SMSOptions): Promise<boolean> {
    try {
      // const { SNSClient, PublishCommand } = require('@aws-sdk/client-sns');
      //
      // const client = new SNSClient({
      //   region: this.configService.get<string>('AWS_REGION'),
      //   credentials: {
      //     accessKeyId: this.configService.get<string>('AWS_ACCESS_KEY_ID'),
      //     secretAccessKey: this.configService.get<string>('AWS_SECRET_ACCESS_KEY'),
      //   },
      // });
      //
      // const command = new PublishCommand({
      //   Message: options.message,
      //   PhoneNumber: options.to,
      // });
      //
      // await client.send(command);

      this.logger.log('SMS sent via AWS SNS (placeholder)');
      return true;
    } catch (error) {
      this.logger.error('AWS SNS error:', error);
      return false;
    }
  }

  /**
   * Validate phone number format
   */
  isValidPhoneNumber(phone: string): boolean {
    // Basic E.164 format validation
    const phoneRegex = /^\+[1-9]\d{1,14}$/;
    return phoneRegex.test(phone);
  }

  /**
   * Format phone number to E.164 format
   */
  formatPhoneNumber(phone: string, defaultCountryCode = '+90'): string {
    // Remove all non-digit characters
    const cleaned = phone.replace(/\D/g, '');

    // If starts with 0, replace with country code
    if (cleaned.startsWith('0')) {
      return defaultCountryCode + cleaned.substring(1);
    }

    // If doesn't start with +, add default country code
    if (!phone.startsWith('+')) {
      return defaultCountryCode + cleaned;
    }

    return '+' + cleaned;
  }
}
