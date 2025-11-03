import {
  Controller,
  Get,
  Patch,
  Post,
  Param,
  Body,
  ParseIntPipe,
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
  async getWidgetSettings(@Param('storeId', ParseIntPipe) storeId: number) {
    return await this.widgetService.getWidgetSettings(storeId);
  }

  @Patch('stores/:storeId/widget-settings')
  @Roles('admin')
  async updateWidgetSettings(
    @Param('storeId', ParseIntPipe) storeId: number,
    @Body() dto: UpdateWidgetSettingsDto,
  ) {
    return await this.widgetService.updateWidgetSettings(storeId, dto);
  }

  @Post('stores/:storeId/widget-settings/regenerate-key')
  @Roles('admin')
  async regenerateWidgetKey(@Param('storeId', ParseIntPipe) storeId: number) {
    return await this.widgetService.regenerateWidgetKey(storeId);
  }

  @Get('stores/:storeId/widget-settings/embed-code')
  @Roles('admin')
  async getEmbedCode(@Param('storeId', ParseIntPipe) storeId: number) {
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
  async getWidgetServices(@Param('widgetKey') widgetKey: string) {
    return await this.widgetService.getWidgetServices(widgetKey);
  }

  @Get('public/widget/:widgetKey/locations')
  @Public()
  async getWidgetLocations(@Param('widgetKey') widgetKey: string) {
    return await this.widgetService.getWidgetLocations(widgetKey);
  }

  @Get('public/widget/:widgetKey/staff')
  @Public()
  async getWidgetStaff(@Param('widgetKey') widgetKey: string) {
    return await this.widgetService.getWidgetStaff(widgetKey);
  }

  @Get('public/widget/:widgetKey/availability')
  @Public()
  async getWidgetAvailability(
    @Param('widgetKey') widgetKey: string,
    @Query('serviceId', ParseIntPipe) serviceId: number,
    @Query('staffId', ParseIntPipe) staffId: number,
    @Query('date') date: string,
    @Query('locationId') locationId?: string,
  ) {
    const locationIdNum = locationId ? parseInt(locationId) : undefined;
    return await this.appointmentsService.getAvailability(
      serviceId,
      staffId,
      date,
      locationIdNum,
    );
  }
}
