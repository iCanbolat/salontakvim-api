import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Netgsm, { ApiErrorCode } from '@netgsm/sms';
import { SMSOptions } from '../../interfaces/notification.interface';
import {
  SmsBulkOptions,
  SmsBulkSendResult,
  SmsProvider,
  SmsSendResult,
} from '../../interfaces/sms-provider.interface';

/**
 * Netgsm SMS provider – handles Turkish mobile numbers (country code +90).
 */
@Injectable()
export class NetgsmProvider implements SmsProvider {
  readonly name = 'netgsm';

  private readonly logger = new Logger(NetgsmProvider.name);
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

  /* ------------------------------------------------------------------ */
  /*  SmsProvider interface                                              */
  /* ------------------------------------------------------------------ */

  /**
   * Returns true for Turkish mobile numbers (+905…).
   */
  supportsNumber(e164Phone: string): boolean {
    return /^\+90/.test(e164Phone);
  }

  async send(options: SMSOptions): Promise<SmsSendResult> {
    try {
      const recipient = this.normalizeForNetgsm(options.to);

      if (!recipient) {
        this.logger.warn(`Invalid phone number for Netgsm: ${options.to}`);
        return {
          success: false,
          provider: this.name,
          error: 'Invalid phone number for Netgsm',
        };
      }

      const header = options.from || this.defaultHeader;

      if (!header) {
        this.logger.error('Netgsm msgheader (sender ID) is not configured');
        return {
          success: false,
          provider: this.name,
          error: 'Netgsm msgheader not configured',
        };
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

      if (
        response?.code &&
        response.code !== ApiErrorCode.SUCCESS &&
        response.code !== '00'
      ) {
        this.logger.warn(
          `Netgsm send failed code=${response.code} description=${response.description}`,
        );
        return {
          success: false,
          provider: this.name,
          error: `Netgsm error ${response.code}: ${response.description}`,
        };
      }

      const messageId = response?.jobid?.toString() || undefined;
      this.logger.log(`Netgsm SMS queued (jobid=${messageId ?? 'unknown'})`);
      return { success: true, provider: this.name, messageId };
    } catch (error) {
      this.logger.error('Failed to send SMS via Netgsm:', error);
      return {
        success: false,
        provider: this.name,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async sendBulk(options: SmsBulkOptions): Promise<SmsBulkSendResult> {
    try {
      const normalizedRecipients = options.to
        .map((phone) => this.normalizeForNetgsm(phone))
        .filter((phone): phone is string => Boolean(phone));

      const invalidCount = options.to.length - normalizedRecipients.length;
      const total = options.to.length;

      if (normalizedRecipients.length === 0) {
        return {
          success: false,
          provider: this.name,
          total,
          sent: 0,
          failed: total,
          error: 'No valid recipients for Netgsm',
        };
      }

      const header = options.from || this.defaultHeader;

      if (!header) {
        this.logger.error('Netgsm msgheader (sender ID) is not configured');
        return {
          success: false,
          provider: this.name,
          total,
          sent: 0,
          failed: total,
          error: 'Netgsm msgheader not configured',
        };
      }

      const client = this.getClient();

      const response = await client.sendRestSms({
        msgheader: header,
        encoding: this.encoding,
        messages: normalizedRecipients.map((recipient) => ({
          msg: options.message,
          no: recipient,
        })),
      });

      if (
        response?.code &&
        response.code !== ApiErrorCode.SUCCESS &&
        response.code !== '00'
      ) {
        this.logger.warn(
          `Netgsm bulk send failed code=${response.code} description=${response.description}`,
        );
        return {
          success: false,
          provider: this.name,
          total,
          sent: 0,
          failed: total,
          error: `Netgsm error ${response.code}: ${response.description}`,
        };
      }

      const sent = normalizedRecipients.length;
      const failed = invalidCount;
      const messageId = response?.jobid?.toString();

      this.logger.log(
        `Netgsm bulk SMS queued (jobid=${messageId ?? 'unknown'}, sent=${sent}, failed=${failed})`,
      );

      return {
        success: true,
        provider: this.name,
        total,
        sent,
        failed,
        messageIds: messageId ? [messageId] : undefined,
      };
    } catch (error) {
      this.logger.error('Failed to send bulk SMS via Netgsm:', error);
      return {
        success: false,
        provider: this.name,
        total: options.to.length,
        sent: 0,
        failed: options.to.length,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /* ------------------------------------------------------------------ */
  /*  Private helpers                                                    */
  /* ------------------------------------------------------------------ */

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
   * Normalise a phone number to the 10-digit format Netgsm expects (5XXXXXXXXX).
   */
  private normalizeForNetgsm(phone: string): string | null {
    const digits = phone.replace(/\D/g, '');

    if (!digits) {
      return null;
    }

    // 5XXXXXXXXX (10 digits)
    if (digits.length === 10 && digits.startsWith('5')) {
      return digits;
    }

    // 05XXXXXXXXX (11 digits)
    if (digits.length === 11 && digits.startsWith('05')) {
      return digits.substring(1);
    }

    // 905XXXXXXXXX (12 digits)
    if (digits.length === 12 && digits.startsWith('905')) {
      return digits.substring(2);
    }

    // fallback – take last 10 digits if they look like a TR mobile number
    const lastTen = digits.slice(-10);
    if (lastTen.length === 10 && lastTen.startsWith('5')) {
      return lastTen;
    }

    return null;
  }
}
