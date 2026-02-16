import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as plivo from 'plivo';
import { SMSOptions } from '../../interfaces/notification.interface';
import {
  SmsBulkOptions,
  SmsBulkSendResult,
  SmsProvider,
  SmsSendResult,
} from '../../interfaces/sms-provider.interface';

/**
 * Plivo SMS provider – handles global (non-TR) phone numbers.
 */
@Injectable()
export class PlivoProvider implements SmsProvider {
  readonly name = 'plivo';
  private readonly maxBulkRecipientsPerRequest = 100;

  private readonly logger = new Logger(PlivoProvider.name);
  private client: plivo.Client | null = null;
  private readonly defaultSrc: string | undefined;

  constructor(private readonly configService: ConfigService) {
    this.defaultSrc = this.configService.get<string>('PLIVO_SENDER_NUMBER');
  }

  /* ------------------------------------------------------------------ */
  /*  SmsProvider interface                                              */
  /* ------------------------------------------------------------------ */

  /**
   * Plivo can handle any E.164 number that is NOT a Turkish +90 number.
   * (Turkish numbers are routed to Netgsm for better cost / reliability.)
   */
  supportsNumber(e164Phone: string): boolean {
    return /^\+[1-9]/.test(e164Phone) && !e164Phone.startsWith('+90');
  }

  async send(options: SMSOptions): Promise<SmsSendResult> {
    try {
      const dst = this.normalizeForPlivo(options.to);

      if (!dst) {
        this.logger.warn(`Invalid phone number for Plivo: ${options.to}`);
        return {
          success: false,
          provider: this.name,
          error: 'Invalid phone number for Plivo',
        };
      }

      const src = options.from || this.defaultSrc;

      if (!src) {
        this.logger.error(
          'Plivo sender number (PLIVO_SENDER_NUMBER) is not configured',
        );
        return {
          success: false,
          provider: this.name,
          error: 'Plivo sender number not configured',
        };
      }

      const client = this.getClient();

      const response = await client.messages.create(src, dst, options.message);

      const messageUuid = response.messageUuid?.[0] ?? undefined;

      this.logger.log(`Plivo SMS queued (uuid=${messageUuid ?? 'unknown'})`);
      return { success: true, provider: this.name, messageId: messageUuid };
    } catch (error) {
      this.logger.error('Failed to send SMS via Plivo:', error);
      return {
        success: false,
        provider: this.name,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async sendBulk(options: SmsBulkOptions): Promise<SmsBulkSendResult> {
    const total = options.to.length;

    try {
      const normalizedRecipients = options.to
        .map((phone) => this.normalizeForPlivo(phone))
        .filter((phone): phone is string => Boolean(phone));

      const invalidCount = total - normalizedRecipients.length;

      if (normalizedRecipients.length === 0) {
        return {
          success: false,
          provider: this.name,
          total,
          sent: 0,
          failed: total,
          error: 'No valid recipients for Plivo',
        };
      }

      const src = options.from || this.defaultSrc;

      if (!src) {
        this.logger.error(
          'Plivo sender number (PLIVO_SENDER_NUMBER) is not configured',
        );
        return {
          success: false,
          provider: this.name,
          total,
          sent: 0,
          failed: total,
          error: 'Plivo sender number not configured',
        };
      }

      const client = this.getClient();
      const chunks = this.chunk(
        normalizedRecipients,
        this.maxBulkRecipientsPerRequest,
      );

      let sent = 0;
      let failed = invalidCount;
      const messageIds: string[] = [];

      for (const chunk of chunks) {
        try {
          const dst = chunk.join('<');
          const response = await client.messages.create(
            src,
            dst,
            options.message,
          );
          sent += chunk.length;
          messageIds.push(...(response.messageUuid ?? []));
        } catch (chunkError) {
          failed += chunk.length;
          this.logger.error(
            `Failed Plivo bulk chunk (${chunk.length} recipients):`,
            chunkError,
          );
        }
      }

      this.logger.log(
        `Plivo bulk SMS processed (sent=${sent}, failed=${failed}, chunks=${chunks.length})`,
      );

      return {
        success: sent > 0,
        provider: this.name,
        total,
        sent,
        failed,
        messageIds: messageIds.length > 0 ? messageIds : undefined,
        error: sent > 0 ? undefined : 'All Plivo bulk chunks failed',
      };
    } catch (error) {
      this.logger.error('Failed to send bulk SMS via Plivo:', error);
      return {
        success: false,
        provider: this.name,
        total,
        sent: 0,
        failed: total,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /* ------------------------------------------------------------------ */
  /*  Private helpers                                                    */
  /* ------------------------------------------------------------------ */

  private getClient(): plivo.Client {
    if (this.client) {
      return this.client;
    }

    const authId = this.configService.get<string>('PLIVO_AUTH_ID');
    const authToken = this.configService.get<string>('PLIVO_AUTH_TOKEN');

    if (!authId || !authToken) {
      throw new Error(
        'Plivo credentials (PLIVO_AUTH_ID / PLIVO_AUTH_TOKEN) are not configured',
      );
    }

    this.client = new plivo.Client(authId, authToken);
    return this.client;
  }

  /**
   * Normalise phone number to E.164 format that Plivo expects (e.g. +14151234567).
   * Returns null if the number cannot be normalised.
   */
  private normalizeForPlivo(phone: string): string | null {
    // Already E.164
    if (/^\+[1-9]\d{6,14}$/.test(phone)) {
      return phone;
    }

    const digits = phone.replace(/\D/g, '');

    if (!digits || digits.length < 7 || digits.length > 15) {
      return null;
    }

    // If the raw input started with '+', trust the digits
    if (phone.startsWith('+')) {
      return `+${digits}`;
    }

    // Assume it's already a full international number without the '+'
    if (digits.length >= 10) {
      return `+${digits}`;
    }

    return null;
  }

  private chunk(values: string[], chunkSize: number): string[][] {
    const chunks: string[][] = [];

    for (let index = 0; index < values.length; index += chunkSize) {
      chunks.push(values.slice(index, index + chunkSize));
    }

    return chunks;
  }
}
