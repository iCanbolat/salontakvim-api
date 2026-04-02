import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import Redis from 'ioredis';
import { WidgetSettingsRepository } from '../repositories/widget-settings.repository';
import { StoreRepository } from '../../stores/repositories/store.repository';
import { ServiceRepository } from '../../services/repositories/service.repository';
import { ServiceExtraRepository } from '../../services/repositories/service-extra.repository';
import { CategoryRepository } from '../../categories/repositories/category.repository';
import { LocationRepository } from '../../locations/repositories/location.repository';
import { StaffMemberRepository } from '../../staff/repositories/staff-member.repository';
import { ServiceStaffRepository } from '../../staff/repositories/service-staff.repository';
import {
  UpdateWidgetSettingsDto,
  WidgetSettingsResponseDto,
  WidgetConfigResponseDto,
  WidgetEmbedCodeResponseDto,
} from '../dto';
import { ConfigService } from '@nestjs/config';
import { WidgetKeyNotFoundException } from '../exceptions';
import { StoreNotFoundException } from '../../stores/exceptions';
import { UserRepository } from '../../auth/repositories/user.repository';
import { AppointmentsService } from '../../appointments/services/appointments.service';
import { CouponService } from '../../coupons/services/coupon.service';
import { CreateCustomerAppointmentDto } from '../../appointments/dto';
import { EmbedTokenService, EmbedTokenPayload } from '../utils/embed-token';
import { NotificationService } from '../../notifications/services/notification.service';
import { REDIS_CLIENT } from '../../redis/redis.constants';
import { PaymentsService } from '../../payments/payments.service';
import { AppointmentRepository } from '../../appointments/repositories/appointment.repository';
import { CreateWidgetCheckoutDto } from '../../payments/dto';

@Injectable()
export class WidgetService {
  private readonly logger = new Logger(WidgetService.name);
  private readonly localhostDomains = new Set(['localhost', '127.0.0.1']);

  constructor(
    private readonly widgetSettingsRepository: WidgetSettingsRepository,
    private readonly storeRepository: StoreRepository,
    private readonly serviceRepository: ServiceRepository,
    private readonly serviceExtraRepository: ServiceExtraRepository,
    private readonly categoryRepository: CategoryRepository,
    private readonly locationRepository: LocationRepository,
    private readonly staffMemberRepository: StaffMemberRepository,
    private readonly serviceStaffRepository: ServiceStaffRepository,
    private readonly configService: ConfigService,
    private readonly userRepository: UserRepository,
    private readonly appointmentsService: AppointmentsService,
    private readonly appointmentRepository: AppointmentRepository,
    private readonly couponService: CouponService,
    private readonly paymentsService: PaymentsService,
    private readonly embedTokenService: EmbedTokenService,
    private readonly notificationService: NotificationService,
    @Inject(REDIS_CLIENT) private readonly redis?: Redis,
  ) {}

  // ============= Admin Widget Settings Management =============

  async getWidgetSettings(storeId: string): Promise<WidgetSettingsResponseDto> {
    const store = await this.storeRepository.findById(storeId);
    if (!store) {
      throw new StoreNotFoundException(storeId.toString());
    }

    let widgetSettings =
      await this.widgetSettingsRepository.findByStoreId(storeId);

    // If no settings exist, create default settings
    if (!widgetSettings) {
      widgetSettings = await this.createDefaultWidgetSettings(storeId);
    }

    if (!widgetSettings.allowedDomains) {
      widgetSettings = await this.widgetSettingsRepository.update(storeId, {
        allowedDomains: [],
      });
    }

    const normalizedSidebar = this.normalizeSidebarMenuItems(
      widgetSettings.sidebarMenuItems,
    );

    const paymentFeatureEnabled = this.isPaymentFeatureEnabled(store);

    return new WidgetSettingsResponseDto({
      ...widgetSettings,
      sidebarMenuItems: {
        ...normalizedSidebar,
        payment: normalizedSidebar.payment && paymentFeatureEnabled,
      },
    } as any);
  }

  async updateAllowedDomains(storeId: string, domains: string[]) {
    await this.ensureWidgetSettingsExists(storeId);
    const sanitizedDomains = this.sanitizeAllowedDomains(domains || []);
    await this.widgetSettingsRepository.update(storeId, {
      allowedDomains: sanitizedDomains,
    });
    return sanitizedDomains;
  }

  private ensureWidgetSettingsExists = async (storeId: string) => {
    let settings = await this.widgetSettingsRepository.findByStoreId(storeId);
    if (!settings) {
      settings = await this.createDefaultWidgetSettings(storeId);
    }

    return settings;
  };

  private async validatePublicAccess(
    widgetSettings: any,
    token?: string,
    origin?: string,
    storeSlug?: string,
  ) {
    const blocked = await this.getWidgetBlockStatus(
      widgetSettings?.widgetKey,
      storeSlug,
    );
    if (blocked?.blocked) {
      throw new ForbiddenException(
        'Widget temporarily disabled due to suspicious activity.',
      );
    }

    let verified = false;
    let tokenError: string | undefined;

    // Check signed embed token (domain-bound JWT)
    if (token) {
      try {
        const payload = this.embedTokenService.verify(token);
        if (payload.storeId !== widgetSettings.storeId) {
          throw new ForbiddenException('Embed token store mismatch');
        }
        if (storeSlug && payload.slug !== storeSlug) {
          throw new ForbiddenException('Embed token slug mismatch');
        }

        // ✅ Seviye 2: Token domain binding kontrolü
        // Token bir domain'e bağlıysa, mevcut origin ile eşleşmeli
        if (payload.domain) {
          const currentHostname = this.extractHostname(origin);
          const enableDomainBinding =
            this.configService.get<string>('ENABLE_TOKEN_DOMAIN_BINDING') ===
            'true';

          if (enableDomainBinding) {
            // Development bypass: localhost ve 127.0.0.1 için domain kontrolü atla
            const isDevelopment = ['localhost', '127.0.0.1'].includes(
              currentHostname || '',
            );

            if (!isDevelopment && currentHostname) {
              if (!this.matchesTokenDomain(payload.domain, currentHostname)) {
                throw new ForbiddenException('Token domain mismatch');
              }
            }
          }
        }

        verified = true;
      } catch (error) {
        tokenError =
          error instanceof Error ? error.message : 'Invalid embed token';
        if (error instanceof ForbiddenException) {
          await this.recordSecurityEvent(widgetSettings.storeId, {
            event: 'invalid_token',
            message: tokenError,
            origin,
            slug: storeSlug,
          });
          throw error;
        }
      }
    }

    if (!verified) {
      await this.recordSecurityEvent(widgetSettings.storeId, {
        event: 'invalid_token',
        message: tokenError || 'Invalid public token',
        origin,
        slug: storeSlug,
      });
      throw new ForbiddenException('Invalid public token');
    }

    try {
      this.validateDomainAccess(widgetSettings, origin);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Domain not allowed';
      await this.recordSecurityEvent(widgetSettings.storeId, {
        event: 'domain_not_allowed',
        message,
        origin,
        slug: storeSlug,
      });
      throw error;
    }
  }

  /**
   * Check if token domain matches current domain
   * Supports wildcard domains like *.example.com
   */
  private matchesTokenDomain(
    tokenDomain: string,
    currentDomain: string,
  ): boolean {
    const normalizedToken = tokenDomain.toLowerCase();
    const normalizedCurrent = currentDomain.toLowerCase();

    // Wildcard domain support: *.example.com matches sub.example.com
    if (normalizedToken.startsWith('*.')) {
      const baseDomain = normalizedToken.slice(2);
      return (
        normalizedCurrent === baseDomain ||
        normalizedCurrent.endsWith(`.${baseDomain}`)
      );
    }

    return normalizedToken === normalizedCurrent;
  }

  private validateDomainAccess(widgetSettings: any, origin?: string) {
    const allowedDomains = widgetSettings.allowedDomains || [];
    if (!this.isDomainAllowed(origin, allowedDomains)) {
      throw new ForbiddenException('Domain not allowed');
    }
  }

  private isDomainAllowed(
    origin: string | undefined,
    allowedDomains: string[],
  ) {
    const hostname = this.extractHostname(origin);

    // localhost is always allowed for local development/integration.
    if (this.isAlwaysAllowedDomain(hostname)) {
      return true;
    }

    const customAllowedDomains =
      this.getConfiguredCustomDomains(allowedDomains);

    // If no domains configured, allow all (including no origin for server-side requests)
    if (!customAllowedDomains.length) {
      return true;
    }

    // If domains are configured but no origin provided, deny
    if (!origin) {
      return false;
    }

    if (!hostname) {
      return false;
    }

    return customAllowedDomains.some((domain) =>
      this.matchesDomain(hostname, domain),
    );
  }

  private extractHostname(origin: string | undefined) {
    if (!origin) {
      return undefined;
    }

    try {
      return new URL(origin).hostname.toLowerCase();
    } catch {
      try {
        return new URL(`http://${origin}`).hostname.toLowerCase();
      } catch {
        return undefined;
      }
    }
  }

  private matchesDomain(hostname: string, allowedDomain: string) {
    const normalizedAllowed = allowedDomain.trim().toLowerCase();
    const normalizedHost = hostname.toLowerCase();

    if (!normalizedAllowed) {
      return false;
    }

    if (normalizedAllowed.startsWith('*.')) {
      const base = normalizedAllowed.slice(2);
      return normalizedHost === base || normalizedHost.endsWith(`.${base}`);
    }

    return normalizedHost === normalizedAllowed;
  }

  private isAlwaysAllowedDomain(hostname?: string) {
    return !!hostname && this.localhostDomains.has(hostname.toLowerCase());
  }

  private normalizeDomainForStorage(domain: string): string | null {
    const raw = domain.trim().toLowerCase();
    if (!raw) {
      return null;
    }

    const hasWildcard = raw.startsWith('*.');
    const hostCandidate = hasWildcard ? raw.slice(2) : raw;

    if (
      !hostCandidate ||
      hostCandidate.includes(' ') ||
      hostCandidate.includes('/') ||
      hostCandidate.includes(':')
    ) {
      throw new BadRequestException(`Invalid domain: ${domain}`);
    }

    let normalizedHost: string;
    try {
      normalizedHost = new URL(
        `http://${hostCandidate}`,
      ).hostname.toLowerCase();
    } catch {
      throw new BadRequestException(`Invalid domain: ${domain}`);
    }

    if (!normalizedHost || normalizedHost !== hostCandidate) {
      throw new BadRequestException(`Invalid domain: ${domain}`);
    }

    return hasWildcard ? `*.${normalizedHost}` : normalizedHost;
  }

  private sanitizeAllowedDomains(domains: string[]) {
    const normalized = Array.from(
      new Set(
        domains
          .map((domain) => this.normalizeDomainForStorage(domain))
          .filter((domain): domain is string => Boolean(domain)),
      ),
    );

    const customDomains = normalized.filter(
      (domain) => !this.localhostDomains.has(domain),
    );

    if (customDomains.length > 1) {
      throw new BadRequestException(
        'Only one custom domain can be configured. localhost is always allowed.',
      );
    }

    // Persist only custom domain. localhost/127.0.0.1 are always allowed implicitly.
    return customDomains;
  }

  private getConfiguredCustomDomains(allowedDomains: string[]) {
    const normalized = allowedDomains
      .map((domain) => domain.trim().toLowerCase())
      .filter(Boolean)
      .filter((domain) => !this.localhostDomains.has(domain));

    // Enforce single-domain policy for legacy records without failing reads.
    return normalized.length > 0 ? [normalized[0]] : [];
  }

  /**
   * Create a signed embed token
   * @param storeId - Store UUID
   * @param slug - Store slug
   * @param domain - Optional domain to bind the token to (for Seviye 2 security)
   */
  createEmbedToken(storeId: string, slug: string, domain?: string): string {
    return this.embedTokenService.sign({ storeId, slug, domain });
  }
  async updateWidgetSettings(
    storeId: string,
    dto: UpdateWidgetSettingsDto,
  ): Promise<WidgetSettingsResponseDto> {
    const store = await this.storeRepository.findById(storeId);
    if (!store) {
      throw new StoreNotFoundException(storeId.toString());
    }

    let widgetSettings =
      await this.widgetSettingsRepository.findByStoreId(storeId);

    if (!widgetSettings) {
      widgetSettings = await this.createDefaultWidgetSettings(storeId);
    }

    const paymentFeatureEnabled = this.isPaymentFeatureEnabled(store);

    const normalizedDto = {
      ...dto,
      ...(dto.sidebarMenuItems
        ? {
            sidebarMenuItems: {
              ...this.normalizeSidebarMenuItems(dto.sidebarMenuItems),
              payment:
                this.normalizeSidebarMenuItems(dto.sidebarMenuItems).payment &&
                paymentFeatureEnabled,
            },
          }
        : {}),
    };

    const updated = await this.widgetSettingsRepository.update(
      storeId,
      normalizedDto,
    );
    const normalizedSidebar = this.normalizeSidebarMenuItems(
      updated.sidebarMenuItems,
    );

    return new WidgetSettingsResponseDto({
      ...updated,
      sidebarMenuItems: {
        ...normalizedSidebar,
        payment: normalizedSidebar.payment && paymentFeatureEnabled,
      },
    } as any);
  }

  async regenerateWidgetKey(
    storeId: string,
  ): Promise<WidgetSettingsResponseDto> {
    let widgetSettings =
      await this.widgetSettingsRepository.findByStoreId(storeId);

    if (!widgetSettings) {
      widgetSettings = await this.createDefaultWidgetSettings(storeId);
    }

    const newWidgetKey = this.widgetSettingsRepository.generateWidgetKey();
    const updated = await this.widgetSettingsRepository.update(storeId, {
      widgetKey: newWidgetKey,
    });

    return new WidgetSettingsResponseDto(updated as any);
  }

  async getEmbedCode(storeId: string): Promise<WidgetEmbedCodeResponseDto> {
    const widgetSettings = await this.getWidgetSettings(storeId);
    const store = await this.storeRepository.findById(storeId);
    if (!store) {
      throw new StoreNotFoundException(storeId.toString());
    }

    const baseUrl =
      this.configService.get<string>('APP_URL') || 'http://localhost:3000';
    const normalizedBaseUrl = baseUrl.replace(/\/$/, '');
    const embedEndpoint = `${normalizedBaseUrl}/api/public/embed/${store.slug}/script.js`;
    const embedCode = `<!-- SalonTakvim Widget (signed embed) -->\n<script src="${embedEndpoint}"></script>`;

    return new WidgetEmbedCodeResponseDto({
      widgetKey: widgetSettings.widgetKey,
      embedCode,
      scriptUrl: embedEndpoint,
      iframeCode:
        '<!-- Iframe embed is deprecated. Use the script embed above for signed, short-lived tokens. -->',
    });
  }

  async getEmbedScriptBySlug(slug: string, origin?: string) {
    const { store, widgetSettings } = await this.resolveContextForEmbedBySlug(
      slug,
      origin,
    );

    // ✅ Seviye 2: Token'a domain bind et (origin varsa)
    const tokenDomain = origin ? this.extractHostname(origin) : undefined;
    const token = this.createEmbedToken(store.id, store.slug, tokenDomain);

    const appUrl =
      this.configService.get<string>('APP_URL') || 'http://localhost:3000';
    const apiBaseUrl =
      this.configService.get<string>('PUBLIC_WIDGET_API_BASE_URL') || appUrl;

    const loaderUrl =
      this.configService.get<string>('WIDGET_LOADER_URL') ||
      `${appUrl}/widget-loader.js`;

    return this.buildEmbedLoaderScript({
      loaderUrl,
      apiBaseUrl,
      widgetKey: widgetSettings.widgetKey,
      slug: store.slug,
      token,
    });
  }

  async getEmbedBootstrapBySlug(slug: string, origin?: string) {
    const { store, widgetSettings } = await this.resolveContextForEmbedBySlug(
      slug,
      origin,
    );

    // ✅ Seviye 2: Token'a domain bind et (origin varsa)
    const tokenDomain = origin ? this.extractHostname(origin) : undefined;
    const token = this.createEmbedToken(store.id, store.slug, tokenDomain);

    const appUrl =
      this.configService.get<string>('APP_URL') || 'http://localhost:3000';
    const apiBaseUrl =
      this.configService.get<string>('PUBLIC_WIDGET_API_BASE_URL') || appUrl;

    const loaderUrl =
      this.configService.get<string>('WIDGET_LOADER_URL') ||
      `${appUrl}/widget-loader.js`;

    return {
      token,
      apiBaseUrl,
      loaderUrl,
      widgetKey: widgetSettings.widgetKey,
      slug: store.slug,
    };
  }

  // ============= Public Widget API =============
  async getWidgetConfig(
    widgetKey: string,
    token?: string,
    origin?: string,
  ): Promise<WidgetConfigResponseDto> {
    const { widgetSettings, store } = await this.resolveContextByWidgetKey(
      widgetKey,
      token,
      origin,
    );

    return this.buildWidgetConfig(widgetSettings, store);
  }

  async getWidgetConfigByStoreSlug(
    slug: string,
    token?: string,
    origin?: string,
  ): Promise<WidgetConfigResponseDto> {
    const { widgetSettings, store } = await this.resolveContextBySlug(
      slug,
      token,
      origin,
    );
    return this.buildWidgetConfig(widgetSettings, store);
  }

  async getWidgetServices(
    widgetKey: string,
    locationId?: string,
    token?: string,
    origin?: string,
  ) {
    const { widgetSettings } = await this.resolveContextByWidgetKey(
      widgetKey,
      token,
      origin,
    );
    return this.getWidgetServicesInternal(widgetSettings, locationId);
  }

  async getWidgetServicesBySlug(
    slug: string,
    locationId?: string,
    token?: string,
    origin?: string,
  ) {
    const { widgetSettings } = await this.resolveContextBySlug(
      slug,
      token,
      origin,
    );
    return this.getWidgetServicesInternal(widgetSettings, locationId);
  }

  async getWidgetServiceExtras(
    widgetKey: string,
    serviceId: string,
    token?: string,
    origin?: string,
  ) {
    const { widgetSettings } = await this.resolveContextByWidgetKey(
      widgetKey,
      token,
      origin,
    );
    return this.getWidgetServiceExtrasInternal(widgetSettings, serviceId);
  }

  async getWidgetServiceExtrasBySlug(
    slug: string,
    serviceId: string,
    token?: string,
    origin?: string,
  ) {
    const { widgetSettings } = await this.resolveContextBySlug(
      slug,
      token,
      origin,
    );
    return this.getWidgetServiceExtrasInternal(widgetSettings, serviceId);
  }

  async getWidgetLocations(widgetKey: string, token?: string, origin?: string) {
    const { widgetSettings } = await this.resolveContextByWidgetKey(
      widgetKey,
      token,
      origin,
    );
    return this.getWidgetLocationsInternal(widgetSettings);
  }

  async getWidgetLocationsBySlug(
    slug: string,
    token?: string,
    origin?: string,
  ) {
    const { widgetSettings } = await this.resolveContextBySlug(
      slug,
      token,
      origin,
    );
    return this.getWidgetLocationsInternal(widgetSettings);
  }

  async getWidgetStaff(
    widgetKey: string,
    filters?: { serviceId?: string; locationId?: string },
    token?: string,
    origin?: string,
  ) {
    const { widgetSettings } = await this.resolveContextByWidgetKey(
      widgetKey,
      token,
      origin,
    );
    return this.getWidgetStaffInternal(widgetSettings, filters);
  }

  async getWidgetStaffBySlug(
    slug: string,
    filters?: { serviceId?: string; locationId?: string },
    token?: string,
    origin?: string,
  ) {
    const { widgetSettings } = await this.resolveContextBySlug(
      slug,
      token,
      origin,
    );
    return this.getWidgetStaffInternal(widgetSettings, filters);
  }

  async getWidgetAvailability(
    widgetKey: string,
    serviceId: string,
    staffId: string,
    date: string,
    locationId?: string,
    token?: string,
    origin?: string,
  ) {
    const { store } = await this.resolveContextByWidgetKey(
      widgetKey,
      token,
      origin,
    );

    return this.appointmentsService.getAvailability(
      store.id,
      serviceId,
      staffId,
      date,
      locationId,
    );
  }

  async getWidgetAvailabilityBySlug(
    slug: string,
    serviceId: string,
    staffId: string,
    date: string,
    locationId?: string,
    token?: string,
    origin?: string,
  ) {
    const { store } = await this.resolveContextBySlug(slug, token, origin);

    return this.appointmentsService.getAvailability(
      store.id,
      serviceId,
      staffId,
      date,
      locationId,
    );
  }

  async createWidgetAppointment(
    widgetKey: string,
    dto: CreateCustomerAppointmentDto,
    token?: string,
    origin?: string,
  ) {
    const { store } = await this.resolveContextByWidgetKey(
      widgetKey,
      token,
      origin,
    );
    const requiresStripePayment =
      (store.country || 'TR').toUpperCase() !== 'TR';

    let stripePaid = false;
    let paidDepositAmount = 0;
    if (requiresStripePayment) {
      if (!dto.paymentSessionId) {
        throw new ForbiddenException(
          'Payment is required before booking this appointment',
        );
      }

      const verification = await this.paymentsService.verifyCheckoutSessionPaid(
        dto.paymentSessionId,
      );

      if (!verification.paid) {
        throw new ForbiddenException('Payment has not been completed yet');
      }

      stripePaid = true;
      paidDepositAmount = Number(verification.paidAmount || 0);
    }

    const appointment =
      await this.appointmentsService.createCustomerAppointment(store.id, dto);

    if (stripePaid) {
      const appointmentTotal = Number(appointment.totalPrice || 0);
      const isFullyPaid = paidDepositAmount >= appointmentTotal;

      await this.appointmentRepository.update(appointment.id, {
        paymentMethod: 'stripe' as any,
        depositAmount: paidDepositAmount.toFixed(2),
        isPaid: isFullyPaid,
        paidAt: isFullyPaid ? new Date() : null,
      });
      return {
        ...appointment,
        paymentMethod: 'stripe',
        depositAmount: paidDepositAmount.toFixed(2),
        isPaid: isFullyPaid,
        paidAt: isFullyPaid ? new Date() : undefined,
      };
    }

    return appointment;
  }

  async validateWidgetCoupon(
    widgetKey: string,
    dto: {
      code: string;
      serviceId?: string;
      amount?: number;
      customerEmail?: string;
    },
    token?: string,
    origin?: string,
  ) {
    const { store } = await this.resolveContextByWidgetKey(
      widgetKey,
      token,
      origin,
    );

    const customer = dto.customerEmail
      ? await this.userRepository.findByEmail(dto.customerEmail)
      : null;

    const validation = await this.couponService.validateCoupon(
      store.id,
      dto.code.trim().toUpperCase(),
      customer?.id,
      dto.serviceId,
      dto.amount,
    );

    return {
      valid: true,
      discountAmount: Number(validation.discountAmount || 0),
      finalAmount: validation.finalAmount,
      coupon: {
        code: validation.coupon.code,
        name: validation.coupon.name,
        type: validation.coupon.type,
        value: validation.coupon.value,
        validUntil: validation.coupon.validUntil?.toISOString?.()
          ? validation.coupon.validUntil.toISOString()
          : String(validation.coupon.validUntil),
      },
    };
  }

  async createWidgetAppointmentBySlug(
    slug: string,
    dto: CreateCustomerAppointmentDto,
    token?: string,
    origin?: string,
  ) {
    const { store } = await this.resolveContextBySlug(slug, token, origin);
    const requiresStripePayment =
      (store.country || 'TR').toUpperCase() !== 'TR';

    let stripePaid = false;
    let paidDepositAmount = 0;
    if (requiresStripePayment) {
      if (!dto.paymentSessionId) {
        throw new ForbiddenException(
          'Payment is required before booking this appointment',
        );
      }

      const verification = await this.paymentsService.verifyCheckoutSessionPaid(
        dto.paymentSessionId,
      );

      if (!verification.paid) {
        throw new ForbiddenException('Payment has not been completed yet');
      }

      stripePaid = true;
      paidDepositAmount = Number(verification.paidAmount || 0);
    }

    const appointment =
      await this.appointmentsService.createCustomerAppointment(store.id, dto);

    if (stripePaid) {
      const appointmentTotal = Number(appointment.totalPrice || 0);
      const isFullyPaid = paidDepositAmount >= appointmentTotal;

      await this.appointmentRepository.update(appointment.id, {
        paymentMethod: 'stripe' as any,
        depositAmount: paidDepositAmount.toFixed(2),
        isPaid: isFullyPaid,
        paidAt: isFullyPaid ? new Date() : null,
      });
      return {
        ...appointment,
        paymentMethod: 'stripe',
        depositAmount: paidDepositAmount.toFixed(2),
        isPaid: isFullyPaid,
        paidAt: isFullyPaid ? new Date() : undefined,
      };
    }

    return appointment;
  }

  async createWidgetPaymentCheckoutSession(
    widgetKey: string,
    dto: CreateWidgetCheckoutDto,
    token?: string,
    origin?: string,
  ) {
    const { store } = await this.resolveContextByWidgetKey(
      widgetKey,
      token,
      origin,
    );

    return this.paymentsService.createWidgetCheckoutSession({
      storeId: store.id,
      serviceId: dto.serviceId,
      extrasData: dto.extrasData,
      couponCode: dto.couponCode,
      customerEmail: dto.customerEmail,
      amountType: dto.amountType,
      depositPercentage: dto.depositPercentage,
      successUrl: dto.successUrl,
      cancelUrl: dto.cancelUrl,
    });
  }

  async createWidgetPaymentCheckoutSessionBySlug(
    slug: string,
    dto: CreateWidgetCheckoutDto,
    token?: string,
    origin?: string,
  ) {
    const { store } = await this.resolveContextBySlug(slug, token, origin);

    return this.paymentsService.createWidgetCheckoutSession({
      storeId: store.id,
      serviceId: dto.serviceId,
      extrasData: dto.extrasData,
      couponCode: dto.couponCode,
      customerEmail: dto.customerEmail,
      amountType: dto.amountType,
      depositPercentage: dto.depositPercentage,
      successUrl: dto.successUrl,
      cancelUrl: dto.cancelUrl,
    });
  }

  async validateWidgetCouponBySlug(
    slug: string,
    dto: {
      code: string;
      serviceId?: string;
      amount?: number;
      customerEmail?: string;
    },
    token?: string,
    origin?: string,
  ) {
    const { store } = await this.resolveContextBySlug(slug, token, origin);

    const customer = dto.customerEmail
      ? await this.userRepository.findByEmail(dto.customerEmail)
      : null;

    const validation = await this.couponService.validateCoupon(
      store.id,
      dto.code.trim().toUpperCase(),
      customer?.id,
      dto.serviceId,
      dto.amount,
    );

    return {
      valid: true,
      discountAmount: Number(validation.discountAmount || 0),
      finalAmount: validation.finalAmount,
      coupon: {
        code: validation.coupon.code,
        name: validation.coupon.name,
        type: validation.coupon.type,
        value: validation.coupon.value,
        validUntil: validation.coupon.validUntil?.toISOString?.()
          ? validation.coupon.validUntil.toISOString()
          : String(validation.coupon.validUntil),
      },
    };
  }

  private async resolveContextByWidgetKey(
    widgetKey: string,
    token?: string,
    origin?: string,
  ) {
    let widgetSettings =
      await this.widgetSettingsRepository.findByWidgetKey(widgetKey);

    if (!widgetSettings) {
      throw new WidgetKeyNotFoundException(widgetKey);
    }

    if (!widgetSettings.allowedDomains) {
      widgetSettings = await this.widgetSettingsRepository.update(
        widgetSettings.storeId,
        { allowedDomains: [] },
      );
    }

    const store = await this.storeRepository.findById(widgetSettings.storeId);
    if (!store) {
      throw new StoreNotFoundException(widgetSettings.storeId.toString());
    }

    await this.validatePublicAccess(widgetSettings, token, origin, store.slug);

    return { store, widgetSettings };
  }

  private async resolveContextBySlug(
    slug: string,
    token?: string,
    origin?: string,
  ) {
    const store = await this.storeRepository.findBySlug(slug);
    if (!store) {
      throw new StoreNotFoundException(slug);
    }

    let widgetSettings = await this.widgetSettingsRepository.findByStoreId(
      store.id,
    );

    if (!widgetSettings) {
      widgetSettings = await this.createDefaultWidgetSettings(store.id);
    }

    if (!widgetSettings.allowedDomains) {
      widgetSettings = await this.widgetSettingsRepository.update(store.id, {
        allowedDomains: [],
      });
    }

    await this.validatePublicAccess(widgetSettings, token, origin, store.slug);

    return { store, widgetSettings };
  }

  private async resolveContextForEmbedBySlug(slug: string, origin?: string) {
    const store = await this.storeRepository.findBySlug(slug);
    if (!store) {
      throw new StoreNotFoundException(slug);
    }

    let widgetSettings = await this.widgetSettingsRepository.findByStoreId(
      store.id,
    );

    if (!widgetSettings) {
      widgetSettings = await this.createDefaultWidgetSettings(store.id);
    }

    if (!widgetSettings.allowedDomains) {
      widgetSettings = await this.widgetSettingsRepository.update(store.id, {
        allowedDomains: [],
      });
    }

    // ✅ Security Level 1: Optional domain validation for embed endpoints
    // This is controlled by ENABLE_EMBED_DOMAIN_CHECK environment variable
    // Development: false (allows server-side calls without Origin header)
    // Production: true (enforces domain allowlist on embed script requests)
    const enableDomainCheck =
      this.configService.get<string>('ENABLE_EMBED_DOMAIN_CHECK') === 'true';

    if (enableDomainCheck) {
      const customAllowedDomains = this.getConfiguredCustomDomains(
        widgetSettings.allowedDomains || [],
      );

      // In production mode, enforce domain validation
      // If no origin provided (server-side call), check if allowedDomains is empty (allow all)
      if (!origin && customAllowedDomains.length > 0) {
        throw new ForbiddenException(
          'Origin header required when domain restrictions are configured',
        );
      }

      // If origin is provided, validate against allowedDomains
      if (origin) {
        this.validateDomainAccess(widgetSettings, origin);
      }
    }

    return { store, widgetSettings };
  }

  async getWidgetSecurityStatus(storeId: string) {
    const store = await this.storeRepository.findById(storeId);
    if (!store) {
      throw new StoreNotFoundException(storeId.toString());
    }

    let widgetSettings = await this.widgetSettingsRepository.findByStoreId(
      store.id,
    );
    if (!widgetSettings) {
      widgetSettings = await this.createDefaultWidgetSettings(store.id);
    }

    const status = await this.getWidgetBlockStatus(
      widgetSettings?.widgetKey,
      store.slug,
    );

    return {
      blocked: Boolean(status?.blocked),
      blockedAt: status?.blockedAt || null,
      reason: status?.reason || null,
      ttlSeconds: status?.ttlSeconds ?? null,
    };
  }

  async unblockWidgetAccess(storeId: string) {
    const store = await this.storeRepository.findById(storeId);
    if (!store) {
      throw new StoreNotFoundException(storeId.toString());
    }

    let widgetSettings = await this.widgetSettingsRepository.findByStoreId(
      store.id,
    );
    if (!widgetSettings) {
      widgetSettings = await this.createDefaultWidgetSettings(store.id);
    }

    await this.clearWidgetBlock(widgetSettings?.widgetKey, store.slug);

    return { unblocked: true };
  }

  private async getWidgetServicesInternal(
    widgetSettings: any,
    locationId?: string,
  ) {
    const services = await this.serviceRepository.findVisibleByStoreId(
      widgetSettings.storeId,
    );

    const categories = await this.categoryRepository.findByStoreId(
      widgetSettings.storeId,
    );

    if (locationId) {
      const staffInStore =
        await this.staffMemberRepository.findVisibleByStoreId(
          widgetSettings.storeId,
        );

      const staffInLocation = staffInStore.filter(
        (member) => member.locationId === locationId,
      );

      if (!staffInLocation.length) {
        return { services: [], categories: [] };
      }

      const serviceIds =
        await this.serviceStaffRepository.findServiceIdsByStaffIds(
          staffInLocation.map((s) => s.id),
        );
      const serviceIdSet = new Set(serviceIds);

      const filteredServices = services.filter((service) =>
        serviceIdSet.has(service.id),
      );

      const filteredCategories = categories.filter((category) =>
        filteredServices.some((service) => service.categoryId === category.id),
      );

      return {
        services: filteredServices,
        categories: filteredCategories,
      };
    }

    return {
      services,
      categories,
    };
  }

  private async getWidgetServiceExtrasInternal(
    widgetSettings: any,
    serviceId: string,
  ) {
    const service = await this.serviceRepository.findById(serviceId);
    if (!service || service.storeId !== widgetSettings.storeId) {
      return { extras: [] };
    }

    const extras = await this.serviceExtraRepository.findByServiceId(serviceId);

    return {
      extras: extras.map((extra) => ({
        id: extra.id,
        serviceId: extra.serviceId,
        name: extra.name,
        description: extra.description,
        price: parseFloat(extra.price),
        duration: extra.duration,
        maxQuantity: extra.maxQuantity,
        position: extra.position,
      })),
    };
  }

  private async getWidgetLocationsInternal(widgetSettings: any) {
    const locations = await this.locationRepository.findVisibleByStoreId(
      widgetSettings.storeId,
    );

    return {
      locations,
    };
  }

  private async getWidgetStaffInternal(
    widgetSettings: any,
    filters?: { serviceId?: string; locationId?: string },
  ) {
    const serviceId = filters?.serviceId;
    const locationId = filters?.locationId;

    let staff = await this.staffMemberRepository.findVisibleByStoreId(
      widgetSettings.storeId,
    );

    if (locationId) {
      staff = staff.filter((member) => member.locationId === locationId);
    }

    if (serviceId) {
      const assignments =
        await this.serviceStaffRepository.findByServiceId(serviceId);
      const staffIdsForService = new Set(
        assignments.map((item) => item.staffId),
      );
      staff = staff.filter((member) => staffIdsForService.has(member.id));
    }

    if (!staff.length) {
      return { staff: [] };
    }

    const users = await this.userRepository.findByIds(
      staff.map((member) => member.userId),
    );
    const userMap = new Map(users.map((user) => [user.id, user]));

    const hydratedStaff = staff.map((member) => {
      const user = userMap.get(member.userId);
      const fullName = [user?.firstName, user?.lastName]
        .filter(Boolean)
        .join(' ')
        .trim();

      return {
        ...member,
        name: fullName || user?.email || 'Personel',
        firstName: user?.firstName ?? null,
        lastName: user?.lastName ?? null,
        email: user?.email ?? null,
        avatar: user?.avatar ?? null,
      };
    });

    return {
      staff: hydratedStaff,
    };
  }

  private buildWidgetConfig(widgetSettings: any, store: any) {
    const fixedDepositAmount = Number(
      this.configService.get<string>('STRIPE_WIDGET_FIXED_DEPOSIT_AMOUNT') ||
        '20',
    );
    const paymentFeatureEnabled = this.isPaymentFeatureEnabled(store);
    const stripeConnectReady =
      Boolean(store.stripeConnectAccountId) &&
      Boolean(store.stripeConnectOnboarded);

    const normalizedSidebar = this.normalizeSidebarMenuItems(
      widgetSettings.sidebarMenuItems,
    );

    return new WidgetConfigResponseDto({
      widgetKey: widgetSettings.widgetKey,
      store: {
        id: store.id,
        name: store.name,
        slug: store.slug,
        description: store.description || undefined,
        logo: store.logo || undefined,
        email: store.email || undefined,
        phone: store.phone || undefined,
        currency: store.currency || 'TRY',
        storeImages: store.storeImages || [],
      },
      layout: widgetSettings.layout,
      showCompanyEmail: widgetSettings.showCompanyEmail ?? true,
      companyEmail: widgetSettings.companyEmail || undefined,
      sidebarMenuItems: {
        ...normalizedSidebar,
        payment: normalizedSidebar.payment && paymentFeatureEnabled,
      },
      payment: {
        enabled: normalizedSidebar.payment && paymentFeatureEnabled,
        canProcessPayments: stripeConnectReady,
        provider: paymentFeatureEnabled ? 'stripe_connect' : null,
        allowPartial: false,
        defaultDepositPercentage: 0,
        fixedDepositAmount,
        publishableKey:
          this.configService.get<string>('STRIPE_PUBLISHABLE_KEY') || undefined,
      },
      styling: {
        primaryColor: widgetSettings.primaryColor ?? '#1A84EE',
        secondaryColor: widgetSettings.secondaryColor ?? '#ffffff',
        sidebarBackgroundColor:
          widgetSettings.sidebarBackgroundColor ?? '#F5F7FA',
        contentBackgroundColor:
          widgetSettings.contentBackgroundColor ?? '#ffffff',
        textColor: widgetSettings.textColor ?? '#333333',
        headingColor: widgetSettings.headingColor ?? '#1A1A1A',
        fontFamily: widgetSettings.fontFamily ?? 'Inter, sans-serif',
        fontSize: widgetSettings.fontSize ?? 14,
        buttonBorderRadius: widgetSettings.buttonBorderRadius ?? 8,
      },
      settings: {
        showProgressBar: widgetSettings.showProgressBar ?? true,
        allowGuestBooking: widgetSettings.allowGuestBooking ?? true,
        redirectUrlAfterBooking:
          widgetSettings.redirectUrlAfterBooking || undefined,
      },
    });
  }

  private isPaymentFeatureEnabled(store: any): boolean {
    const isNonTurkishStore = (store.country || 'TR').toUpperCase() !== 'TR';
    const hasPaidPlan =
      store.paymentStatus === 'pro' || store.paymentStatus === 'business';
    return isNonTurkishStore && hasPaidPlan;
  }

  private normalizeSidebarMenuItems(
    items?: Partial<{
      service: boolean;
      employee: boolean;
      location: boolean;
      extras: boolean;
      dateTime: boolean;
      customerInfo: boolean;
      payment: boolean;
    }> | null,
  ) {
    const normalized = {
      service: true,
      employee: true,
      location: true,
      extras: true,
      dateTime: true,
      customerInfo: true,
      payment: true,
      ...(items || {}),
    };

    normalized.service = true;
    normalized.employee = true;
    normalized.location = true;
    normalized.dateTime = true;
    normalized.customerInfo = true;

    return normalized;
  }

  private async recordSecurityEvent(
    storeId: string,
    data: {
      event: string;
      message: string;
      origin?: string;
      slug?: string;
      metadata?: Record<string, any>;
    },
  ) {
    try {
      const store = await this.storeRepository.findById(storeId);
      if (!store?.ownerId) {
        return;
      }

      const redis = this.redis;
      if (redis) {
        const ttlSeconds = Number(
          this.configService.get<string>('PUBLIC_WIDGET_AUDIT_TTL_SECONDS') ||
            '300',
        );
        if (ttlSeconds > 0) {
          const key = `public_widget_audit:${storeId}:${data.event}`;
          const set = await redis.set(
            key,
            String(Date.now()),
            'EX',
            ttlSeconds,
            'NX',
          );
          if (!set) {
            return;
          }
        }
      }

      const metadata = {
        event: data.event,
        origin: data.origin,
        slug: data.slug,
        ...data.metadata,
      };

      // Skip in-app notification for expired tokens as it is expected behavior
      if (data.message !== 'Embed token expired') {
        await this.notificationService.createInAppNotification(
          store.ownerId,
          storeId,
          'Widget güvenlik uyarısı',
          data.message,
          'security',
          metadata,
        );
      }

      this.logger.warn(
        `Widget security event: ${data.event} (${storeId}) ${data.message}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to record widget security event: ${data.event}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  private async getWidgetBlockStatus(
    widgetKey?: string,
    slug?: string,
  ): Promise<
    | {
        blocked: boolean;
        blockedAt?: string;
        reason?: string;
        ttlSeconds?: number;
      }
    | undefined
  > {
    const redis = this.redis;
    if (!redis) {
      return undefined;
    }

    const keys = [
      widgetKey ? `public_widget_block:widgetKey:${widgetKey}` : null,
      slug ? `public_widget_block:slug:${slug}` : null,
    ].filter(Boolean) as string[];

    for (const key of keys) {
      const value = await redis.get(key);
      if (!value) {
        continue;
      }

      let payload: any = {};
      try {
        payload = JSON.parse(value);
      } catch {
        payload = {};
      }

      const ttlMs = await redis.pttl(key);
      return {
        blocked: true,
        blockedAt: payload.blockedAt,
        reason: payload.reason,
        ttlSeconds: ttlMs > 0 ? Math.ceil(ttlMs / 1000) : undefined,
      };
    }

    return { blocked: false };
  }

  private async clearWidgetBlock(widgetKey?: string, slug?: string) {
    const redis = this.redis;
    if (!redis) {
      return;
    }

    const keys = [
      widgetKey ? `public_widget_block:widgetKey:${widgetKey}` : null,
      slug ? `public_widget_block:slug:${slug}` : null,
    ].filter(Boolean) as string[];

    if (!keys.length) {
      return;
    }

    await redis.del(...keys);
  }

  // ============= Private Helper Methods =============

  private buildEmbedLoaderScript(params: {
    loaderUrl: string;
    apiBaseUrl: string;
    widgetKey: string;
    slug: string;
    token: string;
  }) {
    const config = {
      loaderUrl: params.loaderUrl,
      apiBaseUrl: params.apiBaseUrl,
      widgetKey: params.widgetKey,
      slug: params.slug,
      token: params.token,
    };

    return [
      '(function(){',
      `  const cfg=${JSON.stringify(config)};`,
      '  const s=document.createElement("script");',
      '  const anchor=document.currentScript;',
      '  const container=anchor&&anchor.dataset?anchor.dataset.container:null;',
      '  const mode=anchor&&anchor.dataset?anchor.dataset.mode:null;',
      '  const apiBaseOverride=anchor&&anchor.dataset?anchor.dataset.apiBase:null;',
      '  s.src=cfg.loaderUrl;',
      '  s.async=true;',
      '  s.dataset.widgetKey=cfg.widgetKey;',
      '  s.dataset.slug=cfg.slug;',
      '  s.dataset.token=cfg.token;',
      '  s.dataset.apiBase=apiBaseOverride||cfg.apiBaseUrl;',
      '  if(container){s.dataset.container=container;}',
      '  if(mode){s.dataset.mode=mode;}',
      '  if(anchor&&anchor.parentNode){',
      '    anchor.parentNode.insertBefore(s, anchor.nextSibling);',
      '  }else{',
      '    (document.body||document.head||document.documentElement).appendChild(s);',
      '  }',
      '})();',
    ].join('');
  }

  private async createDefaultWidgetSettings(storeId: string) {
    // Verify store exists
    const store = await this.storeRepository.findById(storeId);
    if (!store) {
      throw new StoreNotFoundException(storeId.toString());
    }

    const widgetKey = this.widgetSettingsRepository.generateWidgetKey();

    return await this.widgetSettingsRepository.create({
      storeId,
      widgetKey,
      allowedDomains: [],
      layout: 'list',
      showCompanyEmail: true,
      companyEmail: store.email,
      sidebarMenuItems: this.normalizeSidebarMenuItems({
        extras: true,
        payment: true,
      }),
      primaryColor: '#1A84EE',
      secondaryColor: '#ffffff',
      sidebarBackgroundColor: '#F5F7FA',
      contentBackgroundColor: '#ffffff',
      textColor: '#333333',
      headingColor: '#1A1A1A',
      fontFamily: 'Inter, sans-serif',
      fontSize: 14,
      buttonBorderRadius: 8,
      showProgressBar: true,
      allowGuestBooking: true,
    });
  }
}
