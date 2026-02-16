import { SMSOptions } from './notification.interface';

export interface SmsBulkOptions {
  to: string[];
  message: string;
  from?: string;
}

/**
 * Result of an SMS send attempt
 */
export interface SmsSendResult {
  success: boolean;
  provider: string;
  messageId?: string;
  error?: string;
}

export interface SmsBulkSendResult {
  success: boolean;
  provider: string;
  total: number;
  sent: number;
  failed: number;
  messageIds?: string[];
  error?: string;
}

/**
 * Common interface all SMS providers must implement
 */
export interface SmsProvider {
  /** Unique provider name (e.g. 'netgsm', 'plivo') */
  readonly name: string;

  /**
   * Send an SMS message through this provider.
   * The provider is responsible for normalising the phone number format
   * it needs internally.
   */
  send(options: SMSOptions): Promise<SmsSendResult>;

  sendBulk(options: SmsBulkOptions): Promise<SmsBulkSendResult>;

  /**
   * Return true when this provider can handle the given E.164 phone number.
   * Used by the factory / orchestrator to pick the right provider.
   */
  supportsNumber(e164Phone: string): boolean;
}

/**
 * Region hint that can be passed alongside SMS options
 * so the orchestrator can pick the best provider.
 */
export type SmsRegion = 'TR' | 'GLOBAL';
