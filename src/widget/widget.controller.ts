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
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { WidgetService } from './services/widget.service';
import { UpdateWidgetSettingsDto } from './dto';
import { AppointmentsService } from '../appointments/services/appointments.service';
import { CreateGuestAppointmentDto } from '../appointments/dto';

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
export class WidgetController {
  constructor(
    private readonly widgetService: WidgetService,
    private readonly appointmentsService: AppointmentsService,
  ) {}

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

  // ============= Public Widget API Endpoints =============

  @Get('public/widget/:widgetKey/config')
  @Public()
  async getWidgetConfig(@Param('widgetKey') widgetKey: string) {
    return await this.widgetService.getWidgetConfig(widgetKey);
  }

  @Get('public/widget/:widgetKey/services')
  @Public()
  async getWidgetServices(
    @Param('widgetKey') widgetKey: string,
    @Query('locationId') locationId?: string,
  ) {
    return await this.widgetService.getWidgetServices(widgetKey, locationId);
  }

  @Get('public/widget/:widgetKey/services/:serviceId/extras')
  @Public()
  async getWidgetServiceExtras(
    @Param('widgetKey') widgetKey: string,
    @Param('serviceId', ParseUUIDPipe) serviceId: string,
  ) {
    return await this.widgetService.getWidgetServiceExtras(
      widgetKey,
      serviceId,
    );
  }

  @Get('public/widget/:widgetKey/locations')
  @Public()
  async getWidgetLocations(@Param('widgetKey') widgetKey: string) {
    return await this.widgetService.getWidgetLocations(widgetKey);
  }

  @Get('public/widget/:widgetKey/staff')
  @Public()
  async getWidgetStaff(
    @Param('widgetKey') widgetKey: string,
    @Query('serviceId') serviceId?: string,
    @Query('locationId') locationId?: string,
  ) {
    return await this.widgetService.getWidgetStaff(widgetKey, {
      serviceId: serviceId,
      locationId: locationId,
    });
  }

  @Get('public/widget/:widgetKey/availability')
  @Public()
  async getWidgetAvailability(
    @Param('widgetKey') widgetKey: string,
    @Query('serviceId', ParseUUIDPipe) serviceId: string,
    @Query('staffId', ParseUUIDPipe) staffId: string,
    @Query('date') date: string,
    @Query('locationId') locationId?: string,
  ) {
    const widgetSettings = await this.widgetService.getWidgetConfig(widgetKey);
    const storeId = widgetSettings.store.id;

    return await this.appointmentsService.getAvailability(
      storeId,
      serviceId,
      staffId,
      date,
      locationId,
    );
  }

  @Post('public/widget/:widgetKey/appointments')
  @Public()
  async createWidgetAppointment(
    @Param('widgetKey') widgetKey: string,
    @Body() dto: CreateGuestAppointmentDto,
  ) {
    // Get store ID from widget key
    const widgetSettings = await this.widgetService.getWidgetConfig(widgetKey);
    const storeId = widgetSettings.store.id;

    // Create guest appointment
    return await this.appointmentsService.createGuestAppointment(storeId, dto);
  }
}
