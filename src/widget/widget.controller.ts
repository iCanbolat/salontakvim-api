import {
  Controller,
  Get,
  Patch,
  Post,
  Param,
  Body,
  ParseUUIDPipe,
  UseGuards,
  Query,
  Header,
  Headers,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { PublicRateLimitGuard } from '../common/guards/public-rate-limit.guard';
import { WidgetService } from './services/widget.service';
import { UpdateWidgetSettingsDto } from './dto';
import { CreateGuestAppointmentDto } from '../appointments/dto';

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
export class WidgetController {
  constructor(private readonly widgetService: WidgetService) {}

  // ============= Admin Widget Settings Endpoints =============

  @Get('stores/:storeId/widget-settings')
  @Roles('admin')
  async getWidgetSettings(@Param('storeId', ParseUUIDPipe) storeId: string) {
    return await this.widgetService.getWidgetSettings(storeId);
  }

  @Patch('stores/:storeId/widget-settings')
  @Roles('admin')
  async updateWidgetSettings(
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Body() dto: UpdateWidgetSettingsDto,
  ) {
    return await this.widgetService.updateWidgetSettings(storeId, dto);
  }

  @Post('stores/:storeId/widget-settings/regenerate-key')
  @Roles('admin')
  async regenerateWidgetKey(@Param('storeId', ParseUUIDPipe) storeId: string) {
    return await this.widgetService.regenerateWidgetKey(storeId);
  }

  @Get('stores/:storeId/widget-settings/embed-code')
  @Roles('admin')
  async getEmbedCode(@Param('storeId', ParseUUIDPipe) storeId: string) {
    return await this.widgetService.getEmbedCode(storeId);
  }

  @Post('stores/:storeId/widget-settings/rotate-public-token')
  @Roles('admin')
  async rotatePublicToken(@Param('storeId', ParseUUIDPipe) storeId: string) {
    const publicToken = await this.widgetService.rotatePublicToken(storeId);
    return { publicToken };
  }

  @Patch('stores/:storeId/widget-settings/allowed-domains')
  @Roles('admin')
  async updateAllowedDomains(
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Body('domains') domains: string[],
  ) {
    const allowedDomains = await this.widgetService.updateAllowedDomains(
      storeId,
      domains,
    );
    return { allowedDomains };
  }

  // ============= Public Widget API Endpoints =============

  @Get('public/embed/:slug/script.js')
  @Public()
  @UseGuards(PublicRateLimitGuard)
  @Header('Content-Type', 'application/javascript')
  @Header('Cache-Control', 'no-store')
  @Header('X-Content-Type-Options', 'nosniff')
  async getEmbedScript(
    @Param('slug') slug: string,
    @Headers('origin') origin?: string,
    @Headers('referer') referer?: string,
  ) {
    const requestOrigin = origin || referer;
    return await this.widgetService.getEmbedScriptBySlug(slug, requestOrigin);
  }

  @Get('public/embed/:slug/bootstrap')
  @Public()
  @UseGuards(PublicRateLimitGuard)
  async getEmbedBootstrap(
    @Param('slug') slug: string,
    @Headers('origin') origin?: string,
    @Headers('referer') referer?: string,
  ) {
    const requestOrigin = origin || referer;
    return await this.widgetService.getEmbedBootstrapBySlug(
      slug,
      requestOrigin,
    );
  }

  @Get('public/widget/:widgetKey/config')
  @Public()
  @UseGuards(PublicRateLimitGuard)
  async getWidgetConfig(
    @Param('widgetKey') widgetKey: string,
    @Query('token') token?: string,
    @Headers('origin') origin?: string,
    @Headers('referer') referer?: string,
  ) {
    const requestOrigin = origin || referer;
    return await this.widgetService.getWidgetConfig(
      widgetKey,
      token,
      requestOrigin,
    );
  }

  @Get('public/store/:slug/widget-config')
  @Public()
  @UseGuards(PublicRateLimitGuard)
  async getWidgetConfigBySlug(
    @Param('slug') slug: string,
    @Query('token') token?: string,
    @Headers('origin') origin?: string,
    @Headers('referer') referer?: string,
  ) {
    const requestOrigin = origin || referer;
    return await this.widgetService.getWidgetConfigByStoreSlug(
      slug,
      token,
      requestOrigin,
    );
  }

  @Get('public/widget/:widgetKey/services')
  @Public()
  @UseGuards(PublicRateLimitGuard)
  async getWidgetServices(
    @Param('widgetKey') widgetKey: string,
    @Query('locationId') locationId?: string,
    @Query('token') token?: string,
    @Headers('origin') origin?: string,
    @Headers('referer') referer?: string,
  ) {
    const requestOrigin = origin || referer;
    return await this.widgetService.getWidgetServices(
      widgetKey,
      locationId,
      token,
      requestOrigin,
    );
  }

  @Get('public/store/:slug/services')
  @Public()
  @UseGuards(PublicRateLimitGuard)
  async getWidgetServicesBySlug(
    @Param('slug') slug: string,
    @Query('locationId') locationId?: string,
    @Query('token') token?: string,
    @Headers('origin') origin?: string,
    @Headers('referer') referer?: string,
  ) {
    const requestOrigin = origin || referer;
    return await this.widgetService.getWidgetServicesBySlug(
      slug,
      locationId,
      token,
      requestOrigin,
    );
  }

  @Get('public/widget/:widgetKey/services/:serviceId/extras')
  @Public()
  @UseGuards(PublicRateLimitGuard)
  async getWidgetServiceExtras(
    @Param('widgetKey') widgetKey: string,
    @Param('serviceId', ParseUUIDPipe) serviceId: string,
    @Query('token') token?: string,
    @Headers('origin') origin?: string,
    @Headers('referer') referer?: string,
  ) {
    const requestOrigin = origin || referer;
    return await this.widgetService.getWidgetServiceExtras(
      widgetKey,
      serviceId,
      token,
      requestOrigin,
    );
  }

  @Get('public/store/:slug/services/:serviceId/extras')
  @Public()
  @UseGuards(PublicRateLimitGuard)
  async getWidgetServiceExtrasBySlug(
    @Param('slug') slug: string,
    @Param('serviceId', ParseUUIDPipe) serviceId: string,
    @Query('token') token?: string,
    @Headers('origin') origin?: string,
    @Headers('referer') referer?: string,
  ) {
    const requestOrigin = origin || referer;
    return await this.widgetService.getWidgetServiceExtrasBySlug(
      slug,
      serviceId,
      token,
      requestOrigin,
    );
  }

  @Get('public/widget/:widgetKey/locations')
  @Public()
  @UseGuards(PublicRateLimitGuard)
  async getWidgetLocations(
    @Param('widgetKey') widgetKey: string,
    @Query('token') token?: string,
    @Headers('origin') origin?: string,
    @Headers('referer') referer?: string,
  ) {
    const requestOrigin = origin || referer;
    return await this.widgetService.getWidgetLocations(
      widgetKey,
      token,
      requestOrigin,
    );
  }

  @Get('public/store/:slug/locations')
  @Public()
  @UseGuards(PublicRateLimitGuard)
  async getWidgetLocationsBySlug(
    @Param('slug') slug: string,
    @Query('token') token?: string,
    @Headers('origin') origin?: string,
    @Headers('referer') referer?: string,
  ) {
    const requestOrigin = origin || referer;
    return await this.widgetService.getWidgetLocationsBySlug(
      slug,
      token,
      requestOrigin,
    );
  }

  @Get('public/widget/:widgetKey/staff')
  @Public()
  @UseGuards(PublicRateLimitGuard)
  async getWidgetStaff(
    @Param('widgetKey') widgetKey: string,
    @Query('serviceId') serviceId?: string,
    @Query('locationId') locationId?: string,
    @Query('token') token?: string,
    @Headers('origin') origin?: string,
    @Headers('referer') referer?: string,
  ) {
    const requestOrigin = origin || referer;
    return await this.widgetService.getWidgetStaff(
      widgetKey,
      { serviceId, locationId },
      token,
      requestOrigin,
    );
  }

  @Get('public/store/:slug/staff')
  @Public()
  @UseGuards(PublicRateLimitGuard)
  async getWidgetStaffBySlug(
    @Param('slug') slug: string,
    @Query('serviceId') serviceId?: string,
    @Query('locationId') locationId?: string,
    @Query('token') token?: string,
    @Headers('origin') origin?: string,
    @Headers('referer') referer?: string,
  ) {
    const requestOrigin = origin || referer;
    return await this.widgetService.getWidgetStaffBySlug(
      slug,
      { serviceId, locationId },
      token,
      requestOrigin,
    );
  }

  @Get('public/widget/:widgetKey/availability')
  @Public()
  @UseGuards(PublicRateLimitGuard)
  async getWidgetAvailability(
    @Param('widgetKey') widgetKey: string,
    @Query('serviceId', ParseUUIDPipe) serviceId: string,
    @Query('staffId', ParseUUIDPipe) staffId: string,
    @Query('date') date: string,
    @Query('locationId') locationId?: string,
    @Query('token') token?: string,
    @Headers('origin') origin?: string,
    @Headers('referer') referer?: string,
  ) {
    const requestOrigin = origin || referer;
    return await this.widgetService.getWidgetAvailability(
      widgetKey,
      serviceId,
      staffId,
      date,
      locationId,
      token,
      requestOrigin,
    );
  }

  @Get('public/store/:slug/availability')
  @Public()
  @UseGuards(PublicRateLimitGuard)
  async getWidgetAvailabilityBySlug(
    @Param('slug') slug: string,
    @Query('serviceId', ParseUUIDPipe) serviceId: string,
    @Query('staffId', ParseUUIDPipe) staffId: string,
    @Query('date') date: string,
    @Query('locationId') locationId?: string,
    @Query('token') token?: string,
    @Headers('origin') origin?: string,
    @Headers('referer') referer?: string,
  ) {
    const requestOrigin = origin || referer;
    return await this.widgetService.getWidgetAvailabilityBySlug(
      slug,
      serviceId,
      staffId,
      date,
      locationId,
      token,
      requestOrigin,
    );
  }

  @Post('public/widget/:widgetKey/appointments')
  @Public()
  @UseGuards(PublicRateLimitGuard)
  async createWidgetAppointment(
    @Param('widgetKey') widgetKey: string,
    @Body() dto: CreateGuestAppointmentDto,
    @Query('token') token?: string,
    @Headers('origin') origin?: string,
    @Headers('referer') referer?: string,
  ) {
    const requestOrigin = origin || referer;
    return await this.widgetService.createWidgetAppointment(
      widgetKey,
      dto,
      token,
      requestOrigin,
    );
  }

  @Post('public/store/:slug/appointments')
  @Public()
  @UseGuards(PublicRateLimitGuard)
  async createWidgetAppointmentBySlug(
    @Param('slug') slug: string,
    @Body() dto: CreateGuestAppointmentDto,
    @Query('token') token?: string,
    @Headers('origin') origin?: string,
    @Headers('referer') referer?: string,
  ) {
    const requestOrigin = origin || referer;
    return await this.widgetService.createWidgetAppointmentBySlug(
      slug,
      dto,
      token,
      requestOrigin,
    );
  }
}
