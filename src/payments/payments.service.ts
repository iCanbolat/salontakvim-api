import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { StoreRepository } from '../stores/repositories/store.repository';
import { UserRepository } from '../auth/repositories/user.repository';
import { ServiceRepository } from '../services/repositories/service.repository';
import { ServiceExtraRepository } from '../services/repositories/service-extra.repository';
import { CouponService } from '../coupons/services/coupon.service';

@Injectable()
export class PaymentsService {
  private readonly stripe: Stripe;

  constructor(
    private readonly configService: ConfigService,
    private readonly storeRepository: StoreRepository,
    private readonly userRepository: UserRepository,
    private readonly serviceRepository: ServiceRepository,
    private readonly serviceExtraRepository: ServiceExtraRepository,
    private readonly couponService: CouponService,
  ) {
    const apiKey = this.configService.get<string>('STRIPE_SECRET_KEY');
    if (!apiKey) {
      throw new Error('STRIPE_SECRET_KEY is not configured');
    }

    this.stripe = new Stripe(apiKey);
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
  ): 'freemium' | 'pro' | 'business' {
    const proPriceId = this.configService.get<string>('STRIPE_SAAS_PRICE_ID');
    const businessPriceId = this.configService.get<string>(
      'STRIPE_SAAS_BUSINESS_PRICE_ID',
    );

    if (priceId && businessPriceId && priceId === businessPriceId) {
      return 'business';
    }

    if (priceId && proPriceId && priceId === proPriceId) {
      return 'pro';
    }

    return 'freemium';
  }

  private resolvePlanFromSubscription(
    subscription: Stripe.Subscription,
  ): 'freemium' | 'pro' | 'business' {
    const metadataPlan = subscription.metadata?.plan as
      | 'pro'
      | 'business'
      | undefined;
    if (metadataPlan === 'pro' || metadataPlan === 'business') {
      return metadataPlan;
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
      updatePayload.paymentStatus = plan === 'freemium' ? 'pro' : plan;
    } else if (
      status === 'canceled' ||
      status === 'unpaid' ||
      status === 'incomplete_expired'
    ) {
      updatePayload.paymentStatus = 'freemium';
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

  async handleStripeWebhook(signature?: string, rawBody?: Buffer) {
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
    plan: 'pro' | 'business' = 'pro',
  ) {
    const store = await this.storeRepository.findById(storeId);
    if (!store) {
      throw new NotFoundException('Store not found');
    }

    if (store.ownerId !== userId) {
      throw new ForbiddenException('You do not own this store');
    }

    this.ensureNonTurkishStore(store);

    const owner = await this.userRepository.findById(userId);
    if (!owner?.email) {
      throw new BadRequestException('Store owner email is required');
    }

    const priceConfigKey =
      plan === 'business'
        ? 'STRIPE_SAAS_BUSINESS_PRICE_ID'
        : 'STRIPE_SAAS_PRICE_ID';
    const priceId = this.configService.get<string>(priceConfigKey);
    if (!priceId) {
      throw new Error(`${priceConfigKey} is not configured`);
    }

    const customerId = await this.ensureStripeCustomer(store, owner.email);

    const session = await this.stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      success_url: successUrl,
      cancel_url: cancelUrl,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      metadata: {
        type: 'saas_subscription',
        storeId: store.id,
        plan,
      },
      subscription_data: {
        metadata: {
          storeId: store.id,
          plan,
        },
      },
    });

    // Update session info but don't overwrite paymentStatus yet
    // paymentStatus should only change on successful payment/webhook
    const updateData: any = {
      stripeSubscriptionStatus: 'checkout_created',
    };

    if (session.subscription) {
      updateData.stripeSubscriptionId = String(session.subscription);
    }

    await this.storeRepository.update(store.id, updateData);

    return {
      checkoutUrl: session.url,
      sessionId: session.id,
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

    if (store.paymentStatus === 'freemium') {
      throw new ForbiddenException(
        'Stripe Connect is available only for paid plans',
      );
    }

    this.ensureNonTurkishStore(store);

    let accountId = store.stripeConnectAccountId;

    if (!accountId) {
      const account = await this.stripe.accounts.create({
        type: 'express',
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        metadata: {
          storeId: store.id,
        },
      });

      accountId = account.id;

      await this.storeRepository.update(store.id, {
        stripeConnectAccountId: account.id,
        stripeConnectOnboarded: false,
      } as any);
    }

    const accountLink = await this.stripe.accountLinks.create({
      account: accountId,
      refresh_url: refreshUrl,
      return_url: returnUrl,
      type: 'account_onboarding',
    });

    return {
      accountId,
      onboardingUrl: accountLink.url,
      expiresAt: accountLink.expires_at,
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

    this.ensureNonTurkishStore(store);

    if (!store.stripeConnectAccountId) {
      return {
        hasAccount: false,
        onboardingComplete: false,
        chargesEnabled: false,
        payoutsEnabled: false,
      };
    }

    const account = await this.stripe.accounts.retrieve(
      store.stripeConnectAccountId,
    );

    const onboardingComplete = Boolean(account.details_submitted);

    if (store.stripeConnectOnboarded !== onboardingComplete) {
      await this.storeRepository.update(store.id, {
        stripeConnectOnboarded: onboardingComplete,
      } as any);
    }

    return {
      hasAccount: true,
      onboardingComplete,
      chargesEnabled: Boolean(account.charges_enabled),
      payoutsEnabled: Boolean(account.payouts_enabled),
      accountId: account.id,
    };
  }

  private async calculateBookingAmount(params: {
    storeId: string;
    serviceId: string;
    extrasData?: Array<{ extraId: string; quantity: number }>;
    couponCode?: string;
    guestEmail?: string;
  }) {
    const service = await this.serviceRepository.findByIdAndStoreId(
      params.serviceId,
      params.storeId,
    );

    if (!service) {
      throw new NotFoundException('Service not found');
    }

    let total = Number(service.price || 0);

    for (const extra of params.extrasData || []) {
      const serviceExtra = await this.serviceExtraRepository.findById(
        extra.extraId,
      );
      if (!serviceExtra || serviceExtra.serviceId !== params.serviceId) {
        throw new BadRequestException(`Invalid extra with ID ${extra.extraId}`);
      }
      total += Number(serviceExtra.price || 0) * extra.quantity;
    }

    if (params.couponCode) {
      const customer = params.guestEmail
        ? await this.userRepository.findByEmail(params.guestEmail)
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
    guestEmail?: string;
    amountType?: 'full' | 'deposit';
    depositPercentage?: number;
    successUrl: string;
    cancelUrl: string;
  }) {
    const store = await this.storeRepository.findById(params.storeId);
    if (!store) {
      throw new NotFoundException('Store not found');
    }

    this.ensureNonTurkishStore(store);

    const connectAccountId = store.stripeConnectAccountId?.trim();
    const isDemoConnectAccount =
      typeof connectAccountId === 'string' &&
      connectAccountId.startsWith('acct_demo_');

    if (!connectAccountId) {
      throw new BadRequestException(
        'Store does not have a Stripe Connect account yet',
      );
    }

    let useConnectDestinationCharge = false;

    if (!isDemoConnectAccount) {
      const account = await this.stripe.accounts.retrieve(connectAccountId);

      if (!account.charges_enabled) {
        throw new BadRequestException(
          'Store Stripe Connect account is not ready to accept payments',
        );
      }

      useConnectDestinationCharge = true;
    }

    const { total, serviceName } = await this.calculateBookingAmount({
      storeId: params.storeId,
      serviceId: params.serviceId,
      extrasData: params.extrasData,
      couponCode: params.couponCode,
      guestEmail: params.guestEmail,
    });

    if (total <= 0) {
      return {
        skipped: true,
        reason: 'Amount is zero after discounts',
        payableAmount: 0,
      };
    }

    const configuredDepositAmount = Number(
      this.configService.get<string>('STRIPE_WIDGET_FIXED_DEPOSIT_AMOUNT') ||
        '20',
    );
    const fixedDepositAmount = Math.max(1, configuredDepositAmount);
    const payableAmount = Math.min(total, fixedDepositAmount);
    const amountType: 'deposit' = 'deposit';

    const currency = this.normalizeCurrency(store.currency || 'USD');
    const amountMinor = this.toMinorUnits(payableAmount, currency);

    const applicationFeePercent = Number(
      this.configService.get<string>(
        'STRIPE_CONNECT_APPLICATION_FEE_PERCENT',
      ) || '0',
    );
    const applicationFeeAmount =
      applicationFeePercent > 0
        ? Math.round((amountMinor * applicationFeePercent) / 100)
        : undefined;

    const returnUrl = params.successUrl.includes('?')
      ? `${params.successUrl}&session_id={CHECKOUT_SESSION_ID}&payment_success=1`
      : `${params.successUrl}?session_id={CHECKOUT_SESSION_ID}&payment_success=1`;

    const paymentIntentData: Stripe.Checkout.SessionCreateParams.PaymentIntentData =
      {
        metadata: {
          storeId: store.id,
          amountType,
          bookingTotal: total.toFixed(2),
          depositAmount: payableAmount.toFixed(2),
        },
      };

    if (useConnectDestinationCharge) {
      paymentIntentData.transfer_data = {
        destination: connectAccountId,
      };

      if (typeof applicationFeeAmount === 'number') {
        paymentIntentData.application_fee_amount = applicationFeeAmount;
      }
    }

    const session = await this.stripe.checkout.sessions.create({
      mode: 'payment',
      ui_mode: 'embedded',
      redirect_on_completion: 'if_required',
      return_url: returnUrl,
      line_items: [
        {
          price_data: {
            currency,
            product_data: {
              name: `${serviceName} (Deposit)`,
            },
            unit_amount: amountMinor,
          },
          quantity: 1,
        },
      ],
      payment_intent_data: paymentIntentData,
      metadata: {
        type: 'widget_booking_payment',
        storeId: store.id,
        amountType,
        bookingTotal: total.toFixed(2),
        depositAmount: payableAmount.toFixed(2),
      },
    });

    return {
      skipped: false,
      checkoutUrl: session.url,
      checkoutClientSecret: (session as any).client_secret || undefined,
      sessionId: session.id,
      amountType,
      payableAmount,
      depositAmount: payableAmount,
      totalAmount: total,
      currency: (store.currency || 'USD').toUpperCase(),
    };
  }

  async verifyCheckoutSessionPaid(sessionId: string): Promise<{
    paid: boolean;
    paymentIntentId?: string;
    paidAmount?: number;
    currency?: string;
  }> {
    const session = await this.stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['payment_intent'],
    });

    const paid = session.payment_status === 'paid';
    const paymentIntentId =
      typeof session.payment_intent === 'string'
        ? session.payment_intent
        : session.payment_intent?.id;

    return {
      paid,
      paymentIntentId,
      paidAmount:
        typeof session.amount_total === 'number'
          ? session.amount_total / 100
          : undefined,
      currency: session.currency ? session.currency.toUpperCase() : undefined,
    };
  }
}
