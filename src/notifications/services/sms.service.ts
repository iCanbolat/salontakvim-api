import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Netgsm, { ApiErrorCode } from '@netgsm/sms';
import { SMSOptions } from '../interfaces/notification.interface';

@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);
  private client: Netgsm | null = null;
  private readonly defaultHeader: string | undefined;
  private readonly encoding: string;

  constructor(private readonly configService: ConfigService) {
    this.defaultHeader =
      this.configService.get<string>('NETGSM_HEADER') ||
      this.configService.get<string>('NETGSM_SENDER') ||
      this.configService.get<string>('NETGSM_MSGHEADER');

    this.encoding = this.configService.get<string>('NETGSM_ENCODING', 'TR');
  }

  /**
   * Send SMS using Netgsm provider
   */
  async sendSMS(options: SMSOptions): Promise<boolean> {
    try {
      const recipient = this.normalizeForNetgsm(options.to);

      if (!recipient) {
        this.logger.warn(`Invalid phone number for Netgsm: ${options.to}`);
        return false;
      }

      const header = options.from || this.defaultHeader;

      if (!header) {
        this.logger.error('Netgsm msgheader (sender ID) is not configured');
        return false;
      }

      const client = this.getClient();

      const response = await client.sendRestSms({
        msgheader: header,
        encoding: this.encoding,
        messages: [
          {
            msg: options.message,
            no: recipient,
          },
        ],
      });

      if (response?.code && response.code !== ApiErrorCode.SUCCESS && response.code !== '00') {
        this.logger.warn(
          `Netgsm send failed code=${response.code} description=${response.description}`,
        );
        return false;
      }

      this.logger.log(`Netgsm SMS queued (jobid=${response?.jobid || 'unknown'})`);
      return true;
    } catch (error) {
      this.logger.error('Failed to send SMS via Netgsm:', error);
      return false;
    }
  }
  
  private getClient(): Netgsm {
    if (this.client) {
      return this.client;
    }

    const username = this.configService.get<string>('NETGSM_USERNAME');
    const password = this.configService.get<string>('NETGSM_PASSWORD');
    const appname = this.configService.get<string>('NETGSM_APPNAME');

    if (!username || !password) {
      throw new Error('Netgsm credentials are not configured');
    }

    this.client = new Netgsm({
      username,
      password,
      ...(appname ? { appname } : {}),
    });

    return this.client;
  }

  /**
   * Validate phone number format
   */
  isValidPhoneNumber(phone: string): boolean {
    const e164Regex = /^\+[1-9]\d{1,14}$/;
    const trMobileRegex = /^(\+?90|0)?5\d{9}$/;

    return e164Regex.test(phone) || trMobileRegex.test(phone);
  }

  /**
   * Format phone number to E.164 format
   */
  formatPhoneNumber(phone: string, defaultCountryCode = '+90'): string {
    // Remove all non-digit characters
    const cleaned = phone.replace(/\D/g, '');

    const countryCode = defaultCountryCode.startsWith('+')
      ? defaultCountryCode
      : `+${defaultCountryCode}`;

    // If starts with 0, replace with country code
    if (cleaned.startsWith('0')) {
      return countryCode + cleaned.substring(1);
    }

    if (cleaned.startsWith('90')) {
      return `+${cleaned}`;
    }

    // If doesn't start with +, add default country code
    if (!phone.startsWith('+')) {
      return countryCode + cleaned;
    }

    return '+' + cleaned;
  }

  private normalizeForNetgsm(phone: string): string | null {
    const digits = phone.replace(/\D/g, '');

    if (!digits) {
      return null;
    }

    if (digits.length === 10 && digits.startsWith('5')) {
      return digits;
    }

    if (digits.length === 11 && digits.startsWith('05')) {
      return digits.substring(1);
    }

    if (digits.length === 12 && digits.startsWith('905')) {
      return digits.substring(2);
    }

    const lastTen = digits.slice(-10);

    if (lastTen.length === 10 && lastTen.startsWith('5')) {
      return lastTen;
    }

    return null;
  }
}
