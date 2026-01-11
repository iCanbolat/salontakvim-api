import { ForbiddenException, Injectable } from '@nestjs/common';
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
import { CreateGuestAppointmentDto } from '../../appointments/dto';
import { randomBytes } from 'crypto';
import { EmbedTokenService, EmbedTokenPayload } from '../utils/embed-token';

@Injectable()
export class WidgetService {
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
    private readonly embedTokenService: EmbedTokenService,
  ) {}

  // ============= Admin Widget Settings Management =============

  async getWidgetSettings(storeId: string): Promise<WidgetSettingsResponseDto> {
    let widgetSettings =
      await this.widgetSettingsRepository.findByStoreId(storeId);

    // If no settings exist, create default settings
    if (!widgetSettings) {
      widgetSettings = await this.createDefaultWidgetSettings(storeId);
    }

    if (!widgetSettings.publicToken) {
      widgetSettings = await this.widgetSettingsRepository.update(storeId, {
        publicToken: this.generatePublicToken(),
      });
    }

    if (!widgetSettings.allowedDomains) {
      widgetSettings = await this.widgetSettingsRepository.update(storeId, {
        allowedDomains: [],
      });
    }

    return new WidgetSettingsResponseDto(widgetSettings as any);
  }

  private generatePublicToken() {
    return randomBytes(24).toString('hex');
  }

  async rotatePublicToken(storeId: string) {
    await this.ensureWidgetSettingsExists(storeId);
    const newToken = this.generatePublicToken();
    await this.widgetSettingsRepository.update(storeId, {
      publicToken: newToken,
    });
    return newToken;
  }

  async updateAllowedDomains(storeId: string, domains: string[]) {
    await this.ensureWidgetSettingsExists(storeId);
    const sanitizedDomains = (domains || [])
      .map((domain) => domain.trim())
      .filter(Boolean);
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

  private validatePublicAccess(
    widgetSettings: any,
    token?: string,
    origin?: string,
    storeSlug?: string,
  ) {
    let verified = false;

    // 1) Check long-lived public token (backward compatibility)
    if (token && token === widgetSettings.publicToken) {
      verified = true;
    }

    // 2) Check short-lived signed embed token
    if (!verified && token) {
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
        if (error instanceof ForbiddenException) {
          throw error;
        }
      }
    }

    if (!verified) {
      throw new ForbiddenException('Invalid public token');
    }

    this.validateDomainAccess(widgetSettings, origin);
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
    // If no domains configured, allow all (including no origin for server-side requests)
    if (!allowedDomains.length) {
      return true;
    }

    // If domains are configured but no origin provided, deny
    if (!origin) {
      return false;
    }

    const hostname = this.extractHostname(origin);
    if (!hostname) {
      return false;
    }

    return allowedDomains.some((domain) =>
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
    let widgetSettings =
      await this.widgetSettingsRepository.findByStoreId(storeId);

    if (!widgetSettings) {
      widgetSettings = await this.createDefaultWidgetSettings(storeId);
    }

    const updated = await this.widgetSettingsRepository.update(storeId, dto);
    return new WidgetSettingsResponseDto(updated as any);
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

    const embedEndpoint = `${baseUrl}/public/embed/${store.slug}/script.js`;
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
    dto: CreateGuestAppointmentDto,
    token?: string,
    origin?: string,
  ) {
    const { store } = await this.resolveContextByWidgetKey(
      widgetKey,
      token,
      origin,
    );
    return this.appointmentsService.createGuestAppointment(store.id, dto);
  }

  async createWidgetAppointmentBySlug(
    slug: string,
    dto: CreateGuestAppointmentDto,
    token?: string,
    origin?: string,
  ) {
    const { store } = await this.resolveContextBySlug(slug, token, origin);
    return this.appointmentsService.createGuestAppointment(store.id, dto);
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

    if (!widgetSettings.publicToken) {
      widgetSettings = await this.widgetSettingsRepository.update(
        widgetSettings.storeId,
        { publicToken: this.generatePublicToken() },
      );
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

    this.validatePublicAccess(widgetSettings, token, origin, store.slug);

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

    if (!widgetSettings.publicToken) {
      widgetSettings = await this.widgetSettingsRepository.update(store.id, {
        publicToken: this.generatePublicToken(),
      });
    }

    if (!widgetSettings.allowedDomains) {
      widgetSettings = await this.widgetSettingsRepository.update(store.id, {
        allowedDomains: [],
      });
    }

    this.validatePublicAccess(widgetSettings, token, origin, store.slug);

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

    if (!widgetSettings.publicToken) {
      widgetSettings = await this.widgetSettingsRepository.update(store.id, {
        publicToken: this.generatePublicToken(),
      });
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
      // In production mode, enforce domain validation
      // If no origin provided (server-side call), check if allowedDomains is empty (allow all)
      if (!origin && (widgetSettings.allowedDomains?.length ?? 0) > 0) {
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
      },
      layout: widgetSettings.layout,
      showCompanyEmail: widgetSettings.showCompanyEmail ?? true,
      companyEmail: widgetSettings.companyEmail || undefined,
      sidebarMenuItems: widgetSettings.sidebarMenuItems as any,
      fieldRequirements: {
        employeeRequired: widgetSettings.employeeRequired ?? false,
        locationRequired: widgetSettings.locationRequired ?? false,
        lastNameRequired: widgetSettings.lastNameRequired ?? true,
        emailRequired: widgetSettings.emailRequired ?? true,
        phoneRequired: widgetSettings.phoneRequired ?? true,
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
      '  s.src=cfg.loaderUrl;',
      '  s.async=true;',
      '  s.dataset.widgetKey=cfg.widgetKey;',
      '  s.dataset.slug=cfg.slug;',
      '  s.dataset.token=cfg.token;',
      '  s.dataset.apiBase=cfg.apiBaseUrl;',
      '  const anchor=document.currentScript;',
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
    const publicToken = this.generatePublicToken();

    return await this.widgetSettingsRepository.create({
      storeId,
      widgetKey,
      publicToken,
      allowedDomains: [],
      layout: 'list',
      showCompanyEmail: true,
      companyEmail: store.email,
      sidebarMenuItems: {
        service: true,
        employee: true,
        location: true,
        extras: true,
        dateTime: true,
        customerInfo: true,
        payment: true,
      },
      employeeRequired: false,
      locationRequired: false,
      lastNameRequired: true,
      emailRequired: true,
      phoneRequired: true,
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
