import { Injectable } from '@nestjs/common';
import { WidgetSettingsRepository } from '../repositories/widget-settings.repository';
import { StoreRepository } from '../../stores/repositories/store.repository';
import { ServiceRepository } from '../../services/repositories/service.repository';
import { CategoryRepository } from '../../categories/repositories/category.repository';
import { LocationRepository } from '../../locations/repositories/location.repository';
import { StaffMemberRepository } from '../../staff/repositories/staff-member.repository';
import {
  UpdateWidgetSettingsDto,
  WidgetSettingsResponseDto,
  WidgetConfigResponseDto,
  WidgetEmbedCodeResponseDto,
} from '../dto';
import { ConfigService } from '@nestjs/config';
import {
  WidgetSettingsNotFoundException,
  WidgetKeyNotFoundException,
} from '../exceptions';
import { StoreNotFoundException } from '../../stores/exceptions';

@Injectable()
export class WidgetService {
  constructor(
    private readonly widgetSettingsRepository: WidgetSettingsRepository,
    private readonly storeRepository: StoreRepository,
    private readonly serviceRepository: ServiceRepository,
    private readonly categoryRepository: CategoryRepository,
    private readonly locationRepository: LocationRepository,
    private readonly staffMemberRepository: StaffMemberRepository,
    private readonly configService: ConfigService,
  ) {}

  // ============= Admin Widget Settings Management =============

  async getWidgetSettings(storeId: number): Promise<WidgetSettingsResponseDto> {
    let widgetSettings =
      await this.widgetSettingsRepository.findByStoreId(storeId);

    // If no settings exist, create default settings
    if (!widgetSettings) {
      widgetSettings = await this.createDefaultWidgetSettings(storeId);
    }

    return new WidgetSettingsResponseDto(widgetSettings as any);
  }

  async updateWidgetSettings(
    storeId: number,
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
    storeId: number,
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

  async getEmbedCode(storeId: number): Promise<WidgetEmbedCodeResponseDto> {
    const widgetSettings = await this.getWidgetSettings(storeId);
    const baseUrl =
      this.configService.get<string>('APP_URL') || 'http://localhost:3000';

    const embedCode = `<!-- SalonTakvim Widget -->
<div id="salontakvim-widget"></div>
<script>
  (function() {
    var script = document.createElement('script');
    script.src = '${baseUrl}/widget/${widgetSettings.widgetKey}/embed.js';
    script.async = true;
    document.body.appendChild(script);
  })();
</script>`;

    const iframeCode = `<iframe 
  src="${baseUrl}/widget/${widgetSettings.widgetKey}/booking" 
  width="100%" 
  height="800" 
  frameborder="0"
  style="border: none; border-radius: 8px;">
</iframe>`;

    return new WidgetEmbedCodeResponseDto({
      widgetKey: widgetSettings.widgetKey,
      embedCode,
      scriptUrl: `${baseUrl}/widget/${widgetSettings.widgetKey}/embed.js`,
      iframeCode,
    });
  }

  // ============= Public Widget API =============

  async getWidgetConfig(widgetKey: string): Promise<WidgetConfigResponseDto> {
    const widgetSettings =
      await this.widgetSettingsRepository.findByWidgetKey(widgetKey);

    if (!widgetSettings) {
      throw new WidgetKeyNotFoundException(widgetKey);
    }

    const store = await this.storeRepository.findById(widgetSettings.storeId);
    if (!store) {
      throw new StoreNotFoundException(widgetSettings.storeId.toString());
    }

    return new WidgetConfigResponseDto({
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

  async getWidgetServices(widgetKey: string) {
    const widgetSettings =
      await this.widgetSettingsRepository.findByWidgetKey(widgetKey);

    if (!widgetSettings) {
      throw new WidgetKeyNotFoundException(widgetKey);
    }

    const services = await this.serviceRepository.findVisibleByStoreId(
      widgetSettings.storeId,
    );

    const categories = await this.categoryRepository.findByStoreId(
      widgetSettings.storeId,
    );

    return {
      services,
      categories,
    };
  }

  async getWidgetLocations(widgetKey: string) {
    const widgetSettings =
      await this.widgetSettingsRepository.findByWidgetKey(widgetKey);

    if (!widgetSettings) {
      throw new WidgetKeyNotFoundException(widgetKey);
    }

    const locations = await this.locationRepository.findVisibleByStoreId(
      widgetSettings.storeId,
    );

    return {
      locations,
    };
  }

  async getWidgetStaff(widgetKey: string) {
    const widgetSettings =
      await this.widgetSettingsRepository.findByWidgetKey(widgetKey);

    if (!widgetSettings) {
      throw new WidgetKeyNotFoundException(widgetKey);
    }

    const staff = await this.staffMemberRepository.findVisibleByStoreId(
      widgetSettings.storeId,
    );

    return {
      staff,
    };
  }

  // ============= Private Helper Methods =============

  private async createDefaultWidgetSettings(storeId: number) {
    // Verify store exists
    const store = await this.storeRepository.findById(storeId);
    if (!store) {
      throw new StoreNotFoundException(storeId.toString());
    }

    const widgetKey = this.widgetSettingsRepository.generateWidgetKey();

    return await this.widgetSettingsRepository.create({
      storeId,
      widgetKey,
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
