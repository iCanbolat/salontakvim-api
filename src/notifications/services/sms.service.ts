import { Injectable, Logger } from '@nestjs/common';
import { SMSOptions } from '../interfaces/notification.interface';
import {
  SmsBulkOptions,
  SmsBulkSendResult,
  SmsRegion,
  SmsSendResult,
} from '../interfaces/sms-provider.interface';
import { SmsProviderFactory } from './providers/sms-provider.factory';

interface SmsOrchestratorBulkResult {
  total: number;
  sent: number;
  failed: number;
  providers: Record<string, { sent: number; failed: number }>;
}

/**
 * High-level SMS orchestrator.
 *
 * All existing callers keep using `sendSMS()`, `isValidPhoneNumber()` and
 * `formatPhoneNumber()` unchanged.  Internally, the service delegates to the
 * correct provider (Netgsm for +90, Plivo for everything else) via the
 * `SmsProviderFactory`.
 */
@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);

  constructor(private readonly providerFactory: SmsProviderFactory) {}

  /* ------------------------------------------------------------------ */
  /*  Public API  – kept backwards-compatible                            */
  /* ------------------------------------------------------------------ */

  /**
   * Send an SMS.  The provider is selected automatically based on the
   * destination number, or you can force a region.
   */
  async sendSMS(options: SMSOptions, region?: SmsRegion): Promise<boolean> {
    const e164 = this.formatPhoneNumber(options.to);
    const provider = this.providerFactory.resolve(e164, region);

    this.logger.debug(`Sending SMS to ${e164} via ${provider.name}`);

    const result: SmsSendResult = await provider.send({
      ...options,
      to: e164,
    });

    if (!result.success) {
      this.logger.warn(`SMS send failed via ${provider.name}: ${result.error}`);
    }

    return result.success;
  }

  /**
   * Send SMS and return the full result object (provider, messageId, etc.).
   */
  async sendSMSDetailed(
    options: SMSOptions,
    region?: SmsRegion,
  ): Promise<SmsSendResult> {
    const e164 = this.formatPhoneNumber(options.to);
    const provider = this.providerFactory.resolve(e164, region);

    return provider.send({ ...options, to: e164 });
  }

  async sendBulkSMS(
    options: SmsBulkOptions,
    region?: SmsRegion,
  ): Promise<SmsOrchestratorBulkResult> {
    const groupedByProvider = new Map<
      string,
      { providerName: string; recipients: string[] }
    >();
    let invalidCount = 0;

    for (const phone of options.to) {
      const e164Phone = this.formatPhoneNumber(phone);

      if (!this.isValidPhoneNumber(e164Phone)) {
        invalidCount += 1;
        continue;
      }

      const provider = this.providerFactory.resolve(e164Phone, region);
      const existing = groupedByProvider.get(provider.name);

      if (existing) {
        existing.recipients.push(e164Phone);
      } else {
        groupedByProvider.set(provider.name, {
          providerName: provider.name,
          recipients: [e164Phone],
        });
      }
    }

    const providerResults: SmsBulkSendResult[] = [];

    for (const group of groupedByProvider.values()) {
      const provider = this.providerFactory.resolve(
        group.recipients[0],
        region,
      );

      const result = await provider.sendBulk({
        to: group.recipients,
        message: options.message,
        from: options.from,
      });

      providerResults.push(result);
    }

    const providers: Record<string, { sent: number; failed: number }> = {};

    for (const result of providerResults) {
      providers[result.provider] = {
        sent: result.sent,
        failed: result.failed,
      };
    }

    const sent = providerResults.reduce((sum, result) => sum + result.sent, 0);
    const failedByProviders = providerResults.reduce(
      (sum, result) => sum + result.failed,
      0,
    );

    const total = options.to.length;
    const failed = failedByProviders + invalidCount;

    return {
      total,
      sent,
      failed,
      providers,
    };
  }

  /**
   * Validate phone number format (E.164 or TR mobile shorthand).
   */
  isValidPhoneNumber(phone: string): boolean {
    const e164Regex = /^\+[1-9]\d{1,14}$/;
    const trMobileRegex = /^(\+?90|0)?5\d{9}$/;

    return e164Regex.test(phone) || trMobileRegex.test(phone);
  }

  /**
   * Format phone number to E.164 format.
   */
  formatPhoneNumber(phone: string, defaultCountryCode = '+90'): string {
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
}
