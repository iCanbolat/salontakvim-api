import {
  BadRequestException,
  ForbiddenException,
  GoneException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomUUID } from 'crypto';
import Redis from 'ioredis';
import Stripe from 'stripe';
import { StoreRepository } from '../stores/repositories/store.repository';
import { UserRepository } from '../auth/repositories/user.repository';
import { ServiceRepository } from '../services/repositories/service.repository';
import { ServiceExtraRepository } from '../services/repositories/service-extra.repository';
import { CouponService } from '../coupons/services/coupon.service';
import { REDIS_CLIENT } from '../redis/redis.constants';
import { CreemProvider } from './providers/creem.provider';
import { StorePayoutRepository } from './repositories/store-payout.repository';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private readonly stripe: Stripe;
  private static readonly DEFAULT_WEBHOOK_DONE_TTL_SECONDS = 60 * 60 * 24 * 7;
  private static readonly DEFAULT_WEBHOOK_LOCK_TTL_SECONDS = 120;

  constructor(
    private readonly configService: ConfigService,
    private readonly storeRepository: StoreRepository,
    private readonly userRepository: UserRepository,
    private readonly serviceRepository: ServiceRepository,
    private readonly serviceExtraRepository: ServiceExtraRepository,
    private readonly couponService: CouponService,
    private readonly creemProvider: CreemProvider,
    private readonly storePayoutRepository: StorePayoutRepository,
    @Optional() @Inject(REDIS_CLIENT) private readonly redis?: Redis,
  ) {
    const apiKey =
      this.configService.get<string>('STRIPE_SECRET_KEY') ||
      'sk_legacy_disabled_placeholder';
    this.stripe = new Stripe(apiKey);

    if (!this.configService.get<string>('STRIPE_SECRET_KEY')) {
      this.logger.warn(
        'STRIPE_SECRET_KEY is not configured. Stripe legacy mode is effectively disabled.',
      );
    }
  }

  private isStripeLegacyEnabled(): boolean {
    return this.configService.get<string>('ENABLE_STRIPE_LEGACY') === 'true';
  }

  private ensureStripeLegacyEnabled() {
    if (!this.isStripeLegacyEnabled()) {
      throw new GoneException(
        'Stripe integration is deprecated and disabled. Creem is the active gateway.',
      );
    }
  }

  private ensureNonTurkishStore(store: any) {
    const isTurkishStore = (store.country || 'TR').toUpperCase() === 'TR';
    if (isTurkishStore) {
      throw new ForbiddenException(
        'Stripe payments are only available for non-Turkish stores',
      );
    }
  }

  private normalizeCurrency(currency: string): string {
    return (currency || 'USD').toLowerCase();
  }

  private toMinorUnits(amount: number, currency: string): number {
    const zeroDecimalCurrencies = new Set([
      'bif',
      'clp',
      'djf',
      'gnf',
      'jpy',
      'kmf',
      'krw',
      'mga',
      'pyg',
      'rwf',
      'ugx',
      'vnd',
      'vuv',
      'xaf',
      'xof',
      'xpf',
    ]);

    const normalized = this.normalizeCurrency(currency);
    if (zeroDecimalCurrencies.has(normalized)) {
      return Math.round(amount);
    }

    return Math.round(amount * 100);
  }

  private toDecimalNumber(value: unknown): number {
    const numeric = Number(value || 0);
    if (!Number.isFinite(numeric)) {
      return 0;
    }

    return Number(numeric.toFixed(2));
  }

  private async ensureStripeCustomer(store: any, ownerEmail: string) {
    if (store.stripeCustomerId) {
      return store.stripeCustomerId;
    }

    const customer = await this.stripe.customers.create({
      email: ownerEmail,
      name: store.name,
      metadata: {
        storeId: store.id,
      },
    });

    await this.storeRepository.update(store.id, {
      stripeCustomerId: customer.id,
    } as any);

    return customer.id;
  }

  private resolvePlanFromPriceId(
    priceId?: string,
  ): 'starter' | 'pro' | 'enterprise' {
    const starterPriceId = this.configService.get<string>(
      'STRIPE_SAAS_STARTER_PRICE_ID',
    );
    const proPriceId = this.configService.get<string>('STRIPE_SAAS_PRICE_ID');
    const enterprisePriceId =
      this.configService.get<string>('STRIPE_SAAS_ENTERPRISE_PRICE_ID') ||
      this.configService.get<string>('STRIPE_SAAS_BUSINESS_PRICE_ID');

    if (priceId && enterprisePriceId && priceId === enterprisePriceId) {
      return 'enterprise';
    }

    if (priceId && starterPriceId && priceId === starterPriceId) {
      return 'starter';
    }

    if (priceId && proPriceId && priceId === proPriceId) {
      return 'pro';
    }

    return 'starter';
  }

  private resolvePlanFromSubscription(
    subscription: Stripe.Subscription,
  ): 'starter' | 'pro' | 'enterprise' {
    if (subscription.metadata?.plan) {
      return this.normalizeSubscriptionPlan(subscription.metadata.plan, 'pro');
    }

    const firstItem = subscription.items.data?.[0];
    const priceId = firstItem?.price?.id;
    return this.resolvePlanFromPriceId(priceId);
  }

  private async updateStoreSubscriptionState(
    storeId: string,
    subscription: Stripe.Subscription,
  ) {
    const status = subscription.status;
    const plan = this.resolvePlanFromSubscription(subscription);

    const updatePayload: any = {
      stripeSubscriptionId: subscription.id,
      stripeSubscriptionStatus: status,
    };

    if (status === 'active' || status === 'trialing') {
      updatePayload.paymentStatus = plan;
    } else if (
      status === 'canceled' ||
      status === 'unpaid' ||
      status === 'incomplete_expired'
    ) {
      updatePayload.paymentStatus = 'starter';
    }

    await this.storeRepository.update(storeId, updatePayload);
  }

  private async resolveStoreIdFromSubscription(
    subscription: Stripe.Subscription,
  ): Promise<string | null> {
    const metadataStoreId = subscription.metadata?.storeId;
    if (metadataStoreId) {
      return metadataStoreId;
    }

    const bySubscription =
      await this.storeRepository.findByStripeSubscriptionId(subscription.id);
    if (bySubscription) {
      return bySubscription.id;
    }

    const customerId =
      typeof subscription.customer === 'string'
        ? subscription.customer
        : subscription.customer?.id;

    if (customerId) {
      const byCustomer =
        await this.storeRepository.findByStripeCustomerId(customerId);
      if (byCustomer) {
        return byCustomer.id;
      }
    }

    return null;
  }

  async handleCreemWebhook(signature?: string, rawBody?: Buffer) {
    const event = this.creemProvider.verifyAndParseWebhook(signature, rawBody);
    const eventRecord = event as unknown as Record<string, unknown>;
    const eventType = String(
      event.event_type || event.eventType || event.type || '',
    );
    const data = (event.data || {}) as Record<string, unknown>;
    const webhookId = this.resolveCreemWebhookId(
      eventRecord,
      rawBody,
      eventType,
      data,
    );

    await this.processCreemWebhookWithIdempotency(webhookId, async () => {
      if (eventType === 'checkout.completed') {
        await this.handleCreemCheckoutCompleted(data);
        return;
      }

      if (eventType.startsWith('subscription.')) {
        await this.handleCreemSubscriptionEvent(eventType, data);
      }
    });
  }

  private resolveCreemWebhookId(
    event: Record<string, unknown>,
    rawBody: Buffer | undefined,
    eventType: string,
    data: Record<string, unknown>,
  ): string {
    const explicitEventId =
      this.getString(event, 'id') ||
      this.getString(event, 'event_id') ||
      this.getString(event, 'eventId');

    if (explicitEventId) {
      return `evt:${explicitEventId}`;
    }

    const checkoutId =
      this.getString(data, 'checkout_id') || this.getString(data, 'id');
    if (eventType && checkoutId) {
      return `fallback:${eventType}:${checkoutId}`;
    }

    const hash = createHash('sha256')
      .update(rawBody || Buffer.from(''))
      .digest('hex');
    return `hash:${hash}`;
  }

  private async processCreemWebhookWithIdempotency(
    webhookId: string,
    processor: () => Promise<void>,
  ) {
    const redis = this.redis;
    if (!redis) {
      await processor();
      return;
    }

    const doneKey = `payments:creem:webhook:done:${webhookId}`;
    const lockKey = `payments:creem:webhook:lock:${webhookId}`;
    const doneTtlSeconds = this.resolvePositiveIntConfig(
      'CREEM_WEBHOOK_IDEMPOTENCY_TTL_SECONDS',
      PaymentsService.DEFAULT_WEBHOOK_DONE_TTL_SECONDS,
    );
    const lockTtlSeconds = this.resolvePositiveIntConfig(
      'CREEM_WEBHOOK_PROCESSING_LOCK_TTL_SECONDS',
      PaymentsService.DEFAULT_WEBHOOK_LOCK_TTL_SECONDS,
    );

    let lockToken: string | null = null;

    try {
      if (redis.status === 'wait') {
        await redis.connect();
      }

      const alreadyProcessed = await redis.get(doneKey);
      if (alreadyProcessed) {
        return;
      }

      lockToken = randomUUID();
      const lockResult = await redis.set(
        lockKey,
        lockToken,
        'EX',
        lockTtlSeconds,
        'NX',
      );

      if (!lockResult) {
        const alreadyDoneAfterLock = await redis.get(doneKey);
        if (alreadyDoneAfterLock) {
          return;
        }

        throw new ServiceUnavailableException(
          'Webhook event is currently being processed. Please retry.',
        );
      }

      await processor();
      await redis.set(doneKey, String(Date.now()), 'EX', doneTtlSeconds);
    } catch (error) {
      if (error instanceof ServiceUnavailableException) {
        throw error;
      }

      if (lockToken) {
        throw error;
      }

      this.logger.warn(
        `Creem webhook idempotency fallback for ${webhookId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      await processor();
    } finally {
      if (lockToken) {
        await this.releaseWebhookLock(redis, lockKey, lockToken);
      }
    }
  }

  private async releaseWebhookLock(
    redis: Redis,
    lockKey: string,
    lockToken: string,
  ) {
    try {
      await redis.eval(
        `if redis.call('GET', KEYS[1]) == ARGV[1] then return redis.call('DEL', KEYS[1]) end return 0`,
        1,
        lockKey,
        lockToken,
      );
    } catch (error) {
      this.logger.warn(
        `Failed to release webhook lock ${lockKey}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  private resolvePositiveIntConfig(key: string, fallback: number): number {
    const raw = this.configService.get<string>(key);
    const parsed = Number(raw);

    if (!Number.isFinite(parsed) || parsed <= 0) {
      return fallback;
    }

    return Math.floor(parsed);
  }

  async handleStripeWebhook(signature?: string, rawBody?: Buffer) {
    this.ensureStripeLegacyEnabled();

    if (!signature) {
      throw new BadRequestException('Missing Stripe signature header');
    }

    if (!rawBody) {
      throw new BadRequestException('Missing raw body for Stripe webhook');
    }

    const webhookSecret = this.configService.get<string>(
      'STRIPE_WEBHOOK_SECRET',
    );
    if (!webhookSecret) {
      throw new BadRequestException('STRIPE_WEBHOOK_SECRET is not configured');
    }

    let event: Stripe.Event;

    try {
      event = this.stripe.webhooks.constructEvent(
        rawBody,
        signature,
        webhookSecret,
      );
    } catch {
      throw new BadRequestException('Invalid Stripe webhook signature');
    }

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.mode === 'subscription' && session.subscription) {
        const subscriptionId =
          typeof session.subscription === 'string'
            ? session.subscription
            : session.subscription.id;

        const subscription = await this.stripe.subscriptions.retrieve(
          subscriptionId,
          {
            expand: ['items.data.price'],
          },
        );

        const storeId = await this.resolveStoreIdFromSubscription(subscription);
        if (storeId) {
          await this.updateStoreSubscriptionState(storeId, subscription);
        }
      }
    }

    if (
      event.type === 'customer.subscription.updated' ||
      event.type === 'customer.subscription.created' ||
      event.type === 'customer.subscription.deleted'
    ) {
      const subscription = event.data.object as Stripe.Subscription;
      const storeId = await this.resolveStoreIdFromSubscription(subscription);
      if (storeId) {
        await this.updateStoreSubscriptionState(storeId, subscription);
      }
    }
  }

  async createSubscriptionCheckoutSession(
    storeId: string,
    userId: string,
    successUrl: string,
    cancelUrl: string,
    plan: 'starter' | 'pro' | 'enterprise' = 'pro',
    billingCycle: 'monthly' | 'annual' = 'monthly',
  ) {
    const store = await this.storeRepository.findById(storeId);
    if (!store) {
      throw new NotFoundException('Store not found');
    }

    if (store.ownerId !== userId) {
      throw new ForbiddenException('You do not own this store');
    }

    const owner = await this.userRepository.findById(userId);
    if (!owner?.email) {
      throw new BadRequestException('Store owner email is required');
    }

    const checkout = await this.creemProvider.createSubscriptionCheckout({
      storeId: store.id,
      customerEmail: owner.email,
      plan,
      billingCycle,
      successUrl,
      cancelUrl,
    });

    await this.storeRepository.update(store.id, {
      paymentGateway: 'creem',
      creemSubscriptionStatus: 'checkout_created',
    } as any);

    return {
      checkoutUrl: checkout.checkoutUrl,
      sessionId: checkout.checkoutId,
      gateway: 'creem',
    };
  }

  async createConnectOnboardingLink(
    storeId: string,
    userId: string,
    refreshUrl: string,
    returnUrl: string,
  ) {
    const store = await this.storeRepository.findById(storeId);
    if (!store) {
      throw new NotFoundException('Store not found');
    }

    if (store.ownerId !== userId) {
      throw new ForbiddenException('You do not own this store');
    }

    const owner = await this.userRepository.findById(userId);
    const ownerEmail = owner?.email || '';
    const ownerName = [owner?.firstName, owner?.lastName]
      .filter(
        (value): value is string =>
          typeof value === 'string' && value.trim().length > 0,
      )
      .join(' ')
      .trim();

    const onboardingUrl = this.resolveCreemRecipientOnboardingUrl({
      storeId: store.id,
      storeSlug: store.slug,
      ownerId: userId,
      ownerEmail,
      ownerName,
      refreshUrl,
      returnUrl,
    });

    const statusSource = this.hasConfiguredCreemRecipientStatusApi()
      ? 'creem_api'
      : 'creem_dashboard_manual';

    return {
      accountId: store.stripeConnectAccountId || '',
      onboardingUrl,
      expiresAt: Math.floor(Date.now() / 1000) + 60 * 60,
      provider: 'creem',
      statusSource,
      onboardingComplete: Boolean(store.stripeConnectOnboarded),
    };
  }

  async getConnectStatus(storeId: string, userId: string) {
    const store = await this.storeRepository.findById(storeId);
    if (!store) {
      throw new NotFoundException('Store not found');
    }

    if (store.ownerId !== userId) {
      throw new ForbiddenException('You do not own this store');
    }

    const fallbackStatus = {
      hasAccount: Boolean(store.stripeConnectAccountId),
      onboardingComplete: Boolean(store.stripeConnectOnboarded),
      chargesEnabled: Boolean(store.stripeConnectOnboarded),
      payoutsEnabled: Boolean(store.stripeConnectOnboarded),
      accountId: store.stripeConnectAccountId || undefined,
      provider: 'creem' as const,
      statusSource: 'creem_dashboard_manual' as const,
    };

    const owner = await this.userRepository.findById(userId);
    const ownerEmail = owner?.email || '';
    const ownerName = [owner?.firstName, owner?.lastName]
      .filter(
        (value): value is string =>
          typeof value === 'string' && value.trim().length > 0,
      )
      .join(' ')
      .trim();

    const statusUrl = this.resolveCreemRecipientStatusUrl({
      storeId: store.id,
      storeSlug: store.slug,
      ownerId: userId,
      ownerEmail,
      ownerName,
    });

    if (!statusUrl) {
      return fallbackStatus;
    }

    try {
      const response = await fetch(statusUrl, {
        method: 'GET',
        headers: this.buildCreemRecipientStatusHeaders(),
      });

      if (!response.ok) {
        this.logger.warn(
          `Creem recipient status request failed for store ${store.id} with status ${response.status}`,
        );
        return fallbackStatus;
      }

      const payload = (await response.json()) as unknown;
      const parsed = this.parseCreemRecipientStatusPayload(payload);

      const accountId = parsed.accountId || fallbackStatus.accountId;
      const onboardingComplete =
        parsed.onboardingComplete ?? fallbackStatus.onboardingComplete;
      const chargesEnabled = parsed.chargesEnabled ?? onboardingComplete;
      const payoutsEnabled = parsed.payoutsEnabled ?? onboardingComplete;
      const hasAccount = Boolean(accountId);

      const shouldPersistAccountId =
        typeof accountId === 'string' &&
        accountId.trim().length > 0 &&
        accountId !== store.stripeConnectAccountId;
      const shouldPersistOnboarding =
        onboardingComplete !== Boolean(store.stripeConnectOnboarded);

      if (shouldPersistAccountId || shouldPersistOnboarding) {
        await this.storeRepository.update(store.id, {
          ...(shouldPersistAccountId
            ? { stripeConnectAccountId: accountId }
            : {}),
          ...(shouldPersistOnboarding
            ? { stripeConnectOnboarded: onboardingComplete }
            : {}),
        } as any);
      }

      return {
        hasAccount,
        onboardingComplete,
        chargesEnabled,
        payoutsEnabled,
        accountId,
        provider: 'creem' as const,
        statusSource: 'creem_api' as const,
      };
    } catch (error) {
      this.logger.warn(
        `Failed to fetch Creem recipient status for store ${store.id}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return fallbackStatus;
    }
  }

  async updateConnectStatus(
    storeId: string,
    userId: string,
    onboardingComplete: boolean,
    accountId?: string,
  ) {
    const store = await this.storeRepository.findById(storeId);
    if (!store) {
      throw new NotFoundException('Store not found');
    }

    if (store.ownerId !== userId) {
      throw new ForbiddenException('You do not own this store');
    }

    const normalizedAccountId =
      typeof accountId === 'string' && accountId.trim().length > 0
        ? accountId.trim()
        : store.stripeConnectAccountId || undefined;

    const updatePayload: Record<string, unknown> = {
      stripeConnectOnboarded: onboardingComplete,
    };

    if (normalizedAccountId) {
      updatePayload.stripeConnectAccountId = normalizedAccountId;
    }

    const updated = await this.storeRepository.update(
      store.id,
      updatePayload as any,
    );

    return {
      hasAccount: Boolean(updated.stripeConnectAccountId),
      onboardingComplete: Boolean(updated.stripeConnectOnboarded),
      chargesEnabled: Boolean(updated.stripeConnectOnboarded),
      payoutsEnabled: Boolean(updated.stripeConnectOnboarded),
      accountId: updated.stripeConnectAccountId || undefined,
      provider: 'creem' as const,
      statusSource: 'creem_dashboard_manual' as const,
    };
  }

  async getStorePayouts(
    storeId: string,
    userId: string,
    options?: {
      status?: 'pending' | 'paid';
      page?: number;
      limit?: number;
    },
  ) {
    const store = await this.storeRepository.findById(storeId);
    if (!store) {
      throw new NotFoundException('Store not found');
    }

    if (store.ownerId !== userId) {
      throw new ForbiddenException('You do not own this store');
    }

    const status = options?.status;
    if (status && status !== 'pending' && status !== 'paid') {
      throw new BadRequestException('Invalid payout status filter');
    }

    const page =
      typeof options?.page === 'number' && Number.isFinite(options.page)
        ? Math.max(Math.floor(options.page), 1)
        : 1;

    const limit =
      typeof options?.limit === 'number' && Number.isFinite(options.limit)
        ? Math.max(Math.floor(options.limit), 1)
        : 10;

    const paginatedPayouts = await this.storePayoutRepository.findByStoreId(
      storeId,
      {
        status,
        page,
        limit,
      },
    );
    const storeSummary =
      await this.storePayoutRepository.getStoreSummary(storeId);

    const normalizedPayouts = paginatedPayouts.data.map((payout) => ({
      id: payout.id,
      transactionId: payout.transactionId,
      grossAmount: this.toDecimalNumber(payout.grossAmount),
      platformFee: this.toDecimalNumber(payout.platformFee),
      netAmount: this.toDecimalNumber(payout.netAmount),
      currency: (payout.currency || store.currency || 'USD').toUpperCase(),
      status: payout.status,
      paidAt: payout.paidAt,
      createdAt: payout.createdAt,
    }));

    const summary = {
      pendingCount: storeSummary.pendingCount,
      paidCount: storeSummary.paidCount,
      pendingNetAmount: this.toDecimalNumber(storeSummary.pendingNetAmount),
      paidNetAmount: this.toDecimalNumber(storeSummary.paidNetAmount),
      currency: (
        storeSummary.currency ||
        store.currency ||
        'USD'
      ).toUpperCase(),
    };

    return {
      payouts: normalizedPayouts,
      summary,
      page: paginatedPayouts.page,
      limit: paginatedPayouts.limit,
      total: paginatedPayouts.total,
      totalPages: paginatedPayouts.totalPages,
      statusFilter: status || 'all',
    };
  }

  async markStorePayoutPaid(storeId: string, userId: string, payoutId: string) {
    const store = await this.storeRepository.findById(storeId);
    if (!store) {
      throw new NotFoundException('Store not found');
    }

    if (store.ownerId !== userId) {
      throw new ForbiddenException('You do not own this store');
    }

    const existingPayout = await this.storePayoutRepository.findById(payoutId);
    if (!existingPayout || existingPayout.storeId !== storeId) {
      throw new NotFoundException('Payout record not found');
    }

    const wasAlreadyPaid = existingPayout.status === 'paid';
    const payout = wasAlreadyPaid
      ? existingPayout
      : await this.storePayoutRepository.markAsPaid(payoutId);

    return {
      payout: {
        id: payout.id,
        transactionId: payout.transactionId,
        grossAmount: this.toDecimalNumber(payout.grossAmount),
        platformFee: this.toDecimalNumber(payout.platformFee),
        netAmount: this.toDecimalNumber(payout.netAmount),
        currency: (payout.currency || store.currency || 'USD').toUpperCase(),
        status: payout.status,
        paidAt: payout.paidAt,
        createdAt: payout.createdAt,
      },
      wasAlreadyPaid,
    };
  }

  private async handleCreemCheckoutCompleted(data: Record<string, unknown>) {
    const checkoutId =
      this.getString(data, 'id') || this.getString(data, 'checkout_id');
    if (!checkoutId) {
      return;
    }

    const customData = this.asRecord(data.metadata);
    const checkoutType = this.getString(customData, 'type');

    if (checkoutType === 'widget_booking_payment') {
      const storeId = this.getString(customData, 'storeId');
      if (!storeId) {
        this.logger.warn(
          `Skipping payout creation for ${checkoutId}: missing storeId`,
        );
        return;
      }

      const grossAmount = this.extractCreemAmount(data);
      const platformFee = 0;
      const netAmount = Math.max(0, grossAmount - platformFee);
      const order = this.asRecord(data.order);
      const currency = this.getString(order, 'currency') || 'USD';

      await this.storePayoutRepository.createPending({
        storeId,
        transactionId: checkoutId,
        grossAmount,
        platformFee,
        netAmount,
        currency,
        metadata: {
          ...customData,
          transactionStatus: this.getString(data, 'status') || 'completed',
        },
      });

      return;
    }

    const storeId = await this.resolveStoreIdFromCreemPayload(data);
    if (!storeId) {
      return;
    }

    const customPlan = this.getString(customData, 'plan');
    const plan = this.normalizeSubscriptionPlan(customPlan, 'pro');

    const customerId =
      this.extractId(data.customer) || this.getString(data, 'customer_id');
    const subscriptionId =
      this.extractId(data.subscription) ||
      this.getString(data, 'subscription_id');

    await this.storeRepository.update(storeId, {
      paymentGateway: 'creem',
      paymentStatus: plan,
      creemCustomerId: customerId,
      creemSubscriptionId: subscriptionId,
      creemSubscriptionStatus: this.getString(data, 'status') || 'completed',
    } as any);
  }

  private async handleCreemSubscriptionEvent(
    eventType: string,
    data: Record<string, unknown>,
  ) {
    const storeId = await this.resolveStoreIdFromCreemPayload(data);
    if (!storeId) {
      return;
    }

    const customData = this.asRecord(data.metadata);
    const customPlan = this.getString(customData, 'plan');
    const resolvedPlan = this.normalizeSubscriptionPlan(customPlan, 'pro');
    const status = this.getString(data, 'status') || eventType;

    const downgradeToStarter =
      eventType === 'subscription.canceled' ||
      eventType === 'subscription.expired' ||
      status === 'canceled' ||
      status === 'past_due';

    const customerId =
      this.extractId(data.customer) || this.getString(data, 'customer_id');
    const subscriptionId =
      this.extractId(data.subscription) ||
      this.getString(data, 'subscription_id') ||
      this.getString(data, 'id');

    await this.storeRepository.update(storeId, {
      paymentGateway: 'creem',
      creemCustomerId: customerId,
      creemSubscriptionId: subscriptionId,
      creemSubscriptionStatus: status,
      paymentStatus: downgradeToStarter ? 'starter' : resolvedPlan,
    } as any);
  }

  private async resolveStoreIdFromCreemPayload(
    data: Record<string, unknown>,
  ): Promise<string | null> {
    const customData = this.asRecord(data.metadata);
    const metadataStoreId = this.getString(customData, 'storeId');
    if (metadataStoreId) {
      return metadataStoreId;
    }

    const subscriptionId =
      this.extractId(data.subscription) ||
      this.getString(data, 'subscription_id') ||
      this.getString(data, 'id');
    if (subscriptionId) {
      const bySubscription =
        await this.storeRepository.findByCreemSubscriptionId(subscriptionId);
      if (bySubscription) {
        return bySubscription.id;
      }
    }

    const customerId =
      this.extractId(data.customer) || this.getString(data, 'customer_id');
    if (customerId) {
      const byCustomer =
        await this.storeRepository.findByCreemCustomerId(customerId);
      if (byCustomer) {
        return byCustomer.id;
      }
    }

    return null;
  }

  private extractCreemAmount(data: Record<string, unknown>): number {
    const order = this.asRecord(data.order);
    const amountValue =
      order?.amount_paid || order?.amount_due || order?.amount;

    if (amountValue === undefined || amountValue === null) {
      return 0;
    }

    if (typeof amountValue === 'number') {
      return Number.isFinite(amountValue) ? amountValue / 100 : 0;
    }

    if (typeof amountValue !== 'string') {
      return 0;
    }

    if (amountValue.includes('.')) {
      const decimalValue = Number(amountValue);
      return Number.isFinite(decimalValue) ? decimalValue : 0;
    }

    const minor = Number(amountValue);
    return Number.isFinite(minor) ? minor / 100 : 0;
  }

  private extractId(value: unknown): string | undefined {
    if (!value) {
      return undefined;
    }

    if (typeof value === 'string') {
      return value.trim() ? value : undefined;
    }

    if (typeof value === 'object' && !Array.isArray(value)) {
      const id = (value as Record<string, unknown>).id;
      return typeof id === 'string' && id.trim() ? id : undefined;
    }

    return undefined;
  }

  private asRecord(value: unknown): Record<string, unknown> | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return null;
    }

    return value as Record<string, unknown>;
  }

  private getString(
    source: Record<string, unknown> | null,
    key: string,
  ): string | undefined {
    if (!source) {
      return undefined;
    }

    const value = source[key];
    return typeof value === 'string' && value.trim() ? value : undefined;
  }

  private normalizeSubscriptionPlan(
    plan: string | undefined,
    fallback: 'starter' | 'pro' | 'enterprise',
  ): 'starter' | 'pro' | 'enterprise' {
    const normalized = (plan || '').toLowerCase();

    if (normalized === 'enterprise' || normalized === 'business') {
      return 'enterprise';
    }

    if (normalized === 'pro') {
      return 'pro';
    }

    if (normalized === 'starter' || normalized === 'freemium') {
      return 'starter';
    }

    return fallback;
  }

  private hasConfiguredCreemRecipientStatusApi(): boolean {
    const template = this.configService.get<string>(
      'CREEM_RECIPIENT_STATUS_URL',
    );
    return typeof template === 'string' && template.trim().length > 0;
  }

  private resolveCreemRecipientOnboardingUrl(params: {
    storeId: string;
    storeSlug: string;
    ownerId: string;
    ownerEmail: string;
    ownerName: string;
    refreshUrl: string;
    returnUrl: string;
  }): string {
    const template = this.configService.get<string>(
      'CREEM_RECIPIENT_ONBOARDING_URL',
    );
    if (!template?.trim()) {
      throw new BadRequestException(
        'CREEM_RECIPIENT_ONBOARDING_URL is not configured',
      );
    }

    return this.interpolateUrlTemplate(template, {
      storeId: params.storeId,
      storeSlug: params.storeSlug,
      ownerId: params.ownerId,
      ownerEmail: params.ownerEmail,
      ownerName: params.ownerName,
      refreshUrl: params.refreshUrl,
      returnUrl: params.returnUrl,
    });
  }

  private resolveCreemRecipientStatusUrl(params: {
    storeId: string;
    storeSlug: string;
    ownerId: string;
    ownerEmail: string;
    ownerName: string;
  }): string | null {
    const template = this.configService.get<string>(
      'CREEM_RECIPIENT_STATUS_URL',
    );
    if (!template?.trim()) {
      return null;
    }

    return this.interpolateUrlTemplate(template, {
      storeId: params.storeId,
      storeSlug: params.storeSlug,
      ownerId: params.ownerId,
      ownerEmail: params.ownerEmail,
      ownerName: params.ownerName,
    });
  }

  private interpolateUrlTemplate(
    template: string,
    values: Record<string, string>,
  ): string {
    return template.replace(/\{([a-zA-Z0-9_]+)\}/g, (_, key: string) => {
      const value = values[key] || '';
      return encodeURIComponent(value);
    });
  }

  private buildCreemRecipientStatusHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      Accept: 'application/json',
    };

    const configuredHeader =
      this.configService.get<string>('CREEM_RECIPIENT_STATUS_AUTH_HEADER') ||
      'x-api-key';
    const headerName = configuredHeader.trim() || 'x-api-key';

    const token =
      this.configService.get<string>('CREEM_RECIPIENT_STATUS_AUTH_TOKEN') ||
      this.configService.get<string>('CREEM_API_KEY') ||
      '';

    if (token.trim()) {
      headers[headerName] = token.trim();
    }

    return headers;
  }

  private parseCreemRecipientStatusPayload(payload: unknown): {
    onboardingComplete?: boolean;
    chargesEnabled?: boolean;
    payoutsEnabled?: boolean;
    accountId?: string;
  } {
    const topLevel = this.asRecord(payload);
    if (!topLevel) {
      return {};
    }

    const data = this.asRecord(topLevel.data) || topLevel;

    return {
      onboardingComplete:
        this.parseBoolean(data.onboardingComplete) ??
        this.parseBoolean(data.onboarding_complete) ??
        this.parseBoolean(data.complete) ??
        this.parseBoolean(data.isComplete) ??
        this.parseBoolean(data.detailsSubmitted) ??
        this.parseBoolean(data.details_submitted),
      chargesEnabled:
        this.parseBoolean(data.chargesEnabled) ??
        this.parseBoolean(data.charges_enabled),
      payoutsEnabled:
        this.parseBoolean(data.payoutsEnabled) ??
        this.parseBoolean(data.payouts_enabled),
      accountId:
        this.getString(data, 'accountId') ||
        this.getString(data, 'account_id') ||
        this.getString(data, 'recipientId') ||
        this.getString(data, 'recipient_id') ||
        this.getString(data, 'id'),
    };
  }

  private parseBoolean(value: unknown): boolean | undefined {
    if (typeof value === 'boolean') {
      return value;
    }

    if (typeof value === 'number') {
      if (value === 1) {
        return true;
      }
      if (value === 0) {
        return false;
      }
      return undefined;
    }

    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      if (!normalized) {
        return undefined;
      }
      if (normalized === 'true' || normalized === '1' || normalized === 'yes') {
        return true;
      }
      if (normalized === 'false' || normalized === '0' || normalized === 'no') {
        return false;
      }
    }

    return undefined;
  }

  private async calculateBookingAmount(params: {
    storeId: string;
    serviceId: string;
    extrasData?: Array<{ extraId: string; quantity: number }>;
    couponCode?: string;
    customerEmail?: string;
  }) {
    const service = await this.serviceRepository.findByIdAndStoreId(
      params.serviceId,
      params.storeId,
    );

    if (!service) {
      throw new NotFoundException('Service not found');
    }

    let total = Number(service.price || 0);

    const extrasData = params.extrasData || [];
    if (extrasData.length > 0) {
      const serviceExtras = await this.serviceExtraRepository.findByIds(
        extrasData.map((extra) => extra.extraId),
      );
      const serviceExtrasById = new Map(
        serviceExtras.map((serviceExtra) => [serviceExtra.id, serviceExtra]),
      );

      for (const extra of extrasData) {
        const serviceExtra = serviceExtrasById.get(extra.extraId);
        if (!serviceExtra || serviceExtra.serviceId !== params.serviceId) {
          throw new BadRequestException(
            `Invalid extra with ID ${extra.extraId}`,
          );
        }
        total += Number(serviceExtra.price || 0) * extra.quantity;
      }
    }

    if (params.couponCode) {
      const customer = params.customerEmail
        ? await this.userRepository.findByEmail(params.customerEmail)
        : null;

      const coupon = await this.couponService.validateCoupon(
        params.storeId,
        params.couponCode.trim().toUpperCase(),
        customer?.id,
        params.serviceId,
        total,
      );

      total = Math.max(0, total - Number(coupon.discountAmount || 0));
    }

    return {
      total,
      serviceName: service.name,
    };
  }

  async createWidgetCheckoutSession(params: {
    storeId: string;
    serviceId: string;
    extrasData?: Array<{ extraId: string; quantity: number }>;
    couponCode?: string;
    customerEmail?: string;
    amountType?: 'full' | 'deposit';
    depositPercentage?: number;
    successUrl: string;
    cancelUrl: string;
  }) {
    const store = await this.storeRepository.findById(params.storeId);
    if (!store) {
      throw new NotFoundException('Store not found');
    }

    const { total, serviceName } = await this.calculateBookingAmount({
      storeId: params.storeId,
      serviceId: params.serviceId,
      extrasData: params.extrasData,
      couponCode: params.couponCode,
      customerEmail: params.customerEmail,
    });

    if (total <= 0) {
      return {
        skipped: true,
        reason: 'Amount is zero after discounts',
        payableAmount: 0,
      };
    }

    const configuredDepositAmount = Number(
      this.configService.get<string>('CREEM_WIDGET_FIXED_DEPOSIT_AMOUNT') ||
        '20',
    );
    const fixedDepositAmount = Math.max(1, configuredDepositAmount);
    const payableAmount = Math.min(total, fixedDepositAmount);
    const amountType: 'deposit' = 'deposit';

    const productId = this.configService.get<string>(
      'CREEM_WIDGET_DEPOSIT_PRODUCT_ID',
    );
    if (!productId) {
      throw new BadRequestException(
        'CREEM_WIDGET_DEPOSIT_PRODUCT_ID is not configured',
      );
    }

    const checkout = await this.creemProvider.createOneTimeCheckout({
      storeId: store.id,
      productId,
      customerEmail: params.customerEmail,
      successUrl: params.successUrl,
      metadata: {
        storeId: store.id,
        serviceId: params.serviceId,
        serviceName,
        amountType,
        bookingTotal: total.toFixed(2),
        depositAmount: payableAmount.toFixed(2),
        source: 'widget',
      },
    });

    await this.storeRepository.update(store.id, {
      paymentGateway: 'creem',
    } as any);

    return {
      skipped: false,
      checkoutUrl: checkout.checkoutUrl,
      checkoutClientSecret: undefined,
      sessionId: checkout.checkoutId,
      amountType,
      payableAmount,
      depositAmount: payableAmount,
      totalAmount: total,
      currency: (store.currency || 'USD').toUpperCase(),
      gateway: 'creem',
    };
  }

  async verifyCheckoutSessionPaid(sessionId: string): Promise<{
    paid: boolean;
    paymentIntentId?: string;
    paidAmount?: number;
    currency?: string;
  }> {
    const verification = await this.creemProvider.verifyCheckoutPaid(sessionId);

    return {
      paid: verification.paid,
      paymentIntentId: sessionId,
      paidAmount: verification.paidAmount,
      currency: verification.currency,
    };
  }
}
