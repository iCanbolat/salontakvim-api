import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Creem } from 'creem';
import type {
  CheckoutEntity,
  CreateCheckoutRequest,
} from 'creem/models/components';
import { createHmac, timingSafeEqual } from 'crypto';

interface CreemWebhookEvent {
  event_type?: string;
  eventType?: string;
  type?: string;
  data?: Record<string, unknown>;
}

@Injectable()
export class CreemProvider {
  private creemClient: Creem | null = null;

  constructor(private readonly configService: ConfigService) {}

  async createSubscriptionCheckout(params: {
    storeId: string;
    customerEmail: string;
    plan: 'starter' | 'pro' | 'enterprise';
    billingCycle: 'monthly' | 'annual';
    successUrl: string;
    cancelUrl: string;
    requestId?: string;
  }): Promise<{ checkoutId: string; checkoutUrl: string }> {
    const productId = this.resolveSubscriptionProductId(
      params.plan,
      params.billingCycle,
    );

    const data = await this.createCheckout({
      productId,
      units: 1,
      requestId:
        params.requestId ||
        `sub_${params.storeId}_${params.plan}_${params.billingCycle}_${Date.now()}`,
      customer: {
        email: params.customerEmail,
      },
      successUrl: params.successUrl,
      metadata: {
        type: 'saas_subscription',
        storeId: params.storeId,
        plan: params.plan,
        billingCycle: params.billingCycle,
        cancelUrl: params.cancelUrl,
      },
    });

    const checkoutId = this.asString(data.id);
    const checkoutUrl = this.extractCheckoutUrl(data);

    if (!checkoutId || !checkoutUrl) {
      throw new BadRequestException(
        'Creem did not return checkout id or checkout url',
      );
    }

    return {
      checkoutId,
      checkoutUrl,
    };
  }

  async createOneTimeCheckout(params: {
    storeId: string;
    productId: string;
    successUrl: string;
    customerEmail?: string;
    metadata: Record<string, string | number>;
    requestId?: string;
  }): Promise<{ checkoutId: string; checkoutUrl: string }> {
    const data = await this.createCheckout({
      productId: params.productId,
      units: 1,
      requestId: params.requestId || `widget_${params.storeId}_${Date.now()}`,
      ...(params.customerEmail
        ? {
            customer: {
              email: params.customerEmail,
            },
          }
        : {}),
      successUrl: params.successUrl,
      metadata: {
        ...params.metadata,
        type: 'widget_booking_payment',
        storeId: params.storeId,
      },
    });

    const checkoutId = this.asString(data.id);
    const checkoutUrl = this.extractCheckoutUrl(data);

    if (!checkoutId || !checkoutUrl) {
      throw new BadRequestException(
        'Creem did not return checkout id or checkout url',
      );
    }

    return {
      checkoutId,
      checkoutUrl,
    };
  }

  async getCheckout(checkoutId: string): Promise<CheckoutEntity> {
    return this.executeCreemRequest(() =>
      this.getClient().checkouts.retrieve(checkoutId),
    );
  }

  async verifyCheckoutPaid(checkoutId: string): Promise<{
    paid: boolean;
    paidAmount?: number;
    currency?: string;
  }> {
    const checkout = await this.getCheckout(checkoutId);
    const status = this.asString(checkout.status)?.toLowerCase() || '';
    const order = checkout.order;

    const amountRaw =
      order?.amountPaid ?? order?.amountDue ?? order?.amount ?? undefined;

    const paidAmount = this.parseAmount(amountRaw);
    const currency = this.asString(order?.currency)?.toUpperCase() || undefined;

    return {
      paid: status === 'completed',
      paidAmount,
      currency,
    };
  }

  verifyAndParseWebhook(
    signatureHeader: string | undefined,
    rawBody: Buffer | undefined,
  ): CreemWebhookEvent {
    if (!signatureHeader) {
      throw new BadRequestException('Missing creem-signature header');
    }

    if (!rawBody) {
      throw new BadRequestException('Missing raw body for Creem webhook');
    }

    const webhookSecret = this.configService.get<string>(
      'CREEM_WEBHOOK_SECRET',
    );
    if (!webhookSecret) {
      throw new BadRequestException('CREEM_WEBHOOK_SECRET is not configured');
    }

    const expectedSignature = createHmac('sha256', webhookSecret)
      .update(rawBody.toString('utf8'))
      .digest('hex');

    if (!this.safeCompare(signatureHeader, expectedSignature)) {
      throw new BadRequestException('Invalid Creem webhook signature');
    }

    try {
      return JSON.parse(rawBody.toString('utf8')) as CreemWebhookEvent;
    } catch {
      throw new BadRequestException('Invalid Creem webhook payload');
    }
  }

  private async createCheckout(
    payload: CreateCheckoutRequest,
  ): Promise<CheckoutEntity> {
    return this.executeCreemRequest(() =>
      this.getClient().checkouts.create(payload),
    );
  }

  private resolveSubscriptionProductId(
    plan: 'starter' | 'pro' | 'enterprise',
    billingCycle: 'monthly' | 'annual',
  ): string {
    const keyCandidates: string[] = [];

    if (plan === 'starter') {
      keyCandidates.push(
        billingCycle === 'annual'
          ? 'CREEM_SUBSCRIPTION_STARTER_ANNUAL_PRODUCT_ID'
          : 'CREEM_SUBSCRIPTION_STARTER_MONTHLY_PRODUCT_ID',
      );
    }

    if (plan === 'pro') {
      keyCandidates.push(
        billingCycle === 'annual'
          ? 'CREEM_SUBSCRIPTION_PRO_ANNUAL_PRODUCT_ID'
          : 'CREEM_SUBSCRIPTION_PRO_MONTHLY_PRODUCT_ID',
      );
    }

    if (plan === 'enterprise') {
      keyCandidates.push(
        billingCycle === 'annual'
          ? 'CREEM_SUBSCRIPTION_ENTERPRISE_ANNUAL_PRODUCT_ID'
          : 'CREEM_SUBSCRIPTION_ENTERPRISE_MONTHLY_PRODUCT_ID',
      );
    }

    for (const key of keyCandidates) {
      const value = this.configService.get<string>(key);
      if (value) {
        return value;
      }
    }

    throw new BadRequestException(
      `Missing Creem product configuration for ${plan}/${billingCycle}. Checked: ${keyCandidates.join(', ')}`,
    );
  }

  private parseAmount(value: unknown): number | undefined {
    if (typeof value === 'number') {
      return Number.isFinite(value) ? value / 100 : undefined;
    }

    if (typeof value === 'string') {
      if (!value.trim()) {
        return undefined;
      }

      if (value.includes('.')) {
        const decimalValue = Number(value);
        return Number.isFinite(decimalValue) ? decimalValue : undefined;
      }

      const minor = Number(value);
      return Number.isFinite(minor) ? minor / 100 : undefined;
    }

    return undefined;
  }

  private extractCheckoutUrl(data: CheckoutEntity): string | undefined {
    return this.asString(data.checkoutUrl);
  }

  private asRecord(value: unknown): Record<string, unknown> | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return null;
    }

    return value as Record<string, unknown>;
  }

  private asString(value: unknown): string | undefined {
    return typeof value === 'string' && value.trim() ? value : undefined;
  }

  private getClient(): Creem {
    if (this.creemClient) {
      return this.creemClient;
    }

    const apiKey = this.configService.get<string>('CREEM_API_KEY');
    if (!apiKey) {
      throw new BadRequestException('CREEM_API_KEY is not configured');
    }

    const serverURL = this.resolveCreemServerUrl();
    this.creemClient = new Creem({
      apiKey,
      ...(serverURL ? { serverURL } : {}),
    });

    return this.creemClient;
  }

  private resolveCreemServerUrl(): string | undefined {
    const explicitBaseUrl =
      this.configService.get<string>('CREEM_API_BASE_URL');
    if (explicitBaseUrl?.trim()) {
      return this.normalizeServerUrl(explicitBaseUrl);
    }

    const isTestMode =
      this.configService.get<string>('CREEM_TEST_MODE') === 'true';
    return isTestMode ? 'https://test-api.creem.io' : 'https://api.creem.io';
  }

  private normalizeServerUrl(url: string): string {
    const withoutTrailingSlash = url.trim().replace(/\/+$/, '');
    return withoutTrailingSlash.replace(/\/v1$/i, '');
  }

  private async executeCreemRequest<T>(
    operation: () => Promise<T>,
  ): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      this.handleCreemError(error);
    }
  }

  private handleCreemError(error: unknown): never {
    const statusCode = this.extractStatusCode(error);
    const message = this.extractCreemErrorMessage(error);

    if (statusCode === 401 || statusCode === 403) {
      throw new ForbiddenException(message || 'Creem denied this request');
    }

    throw new BadRequestException(
      message ||
        (statusCode
          ? `Creem API request failed with status ${statusCode}`
          : 'Creem API request failed'),
    );
  }

  private extractStatusCode(error: unknown): number | undefined {
    if (!error || typeof error !== 'object') {
      return undefined;
    }

    const candidate = (error as { statusCode?: unknown }).statusCode;
    return typeof candidate === 'number' && Number.isFinite(candidate)
      ? candidate
      : undefined;
  }

  private extractCreemErrorMessage(error: unknown): string | undefined {
    if (error && typeof error === 'object') {
      const body = this.asString((error as { body?: unknown }).body);
      if (body) {
        try {
          const payload = JSON.parse(body) as Record<string, unknown>;
          const parsedMessage = this.readErrorMessage(payload);
          if (parsedMessage) {
            return parsedMessage;
          }
        } catch {
          return body;
        }
      }
    }

    if (error instanceof Error) {
      return this.asString(error.message);
    }

    return undefined;
  }

  private readErrorMessage(
    payload: Record<string, unknown>,
  ): string | undefined {
    const directMessage = this.asString(payload.message);
    if (directMessage) {
      return directMessage;
    }

    const errorEntity = this.asRecord(payload.error);
    const nestedMessage = this.asString(errorEntity?.message);
    if (nestedMessage) {
      return nestedMessage;
    }

    const errors = Array.isArray(payload.errors) ? payload.errors : [];
    for (const item of errors) {
      const itemRecord = this.asRecord(item);
      const itemMessage = this.asString(itemRecord?.message);
      if (itemMessage) {
        return itemMessage;
      }
    }

    return undefined;
  }

  private safeCompare(a: string, b: string): boolean {
    try {
      const aBuffer = Buffer.from(a, 'hex');
      const bBuffer = Buffer.from(b, 'hex');

      if (aBuffer.length !== bBuffer.length) {
        return false;
      }

      return timingSafeEqual(aBuffer, bBuffer);
    } catch {
      return false;
    }
  }
}
