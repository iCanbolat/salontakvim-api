import {
  Controller,
  Get,
  Query,
  Param,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { AnalyticsService } from './services/analytics.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AnalyticsQueryDto } from './dto';

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('stores/:storeId/analytics/dashboard')
  @Roles('admin', 'staff')
  async getDashboard(
    @Param('storeId', ParseIntPipe) storeId: number,
    @CurrentUser('sub') userId: number,
    @Query() query: AnalyticsQueryDto,
  ) {
    return this.analyticsService.getDashboard(storeId, userId, query);
  }

  @Get('stores/:storeId/analytics/appointments')
  @Roles('admin', 'staff')
  async getAppointmentAnalytics(
    @Param('storeId', ParseIntPipe) storeId: number,
    @CurrentUser('sub') userId: number,
    @Query() query: AnalyticsQueryDto,
  ) {
    return this.analyticsService.getAppointmentAnalytics(
      storeId,
      userId,
      query,
    );
  }

  @Get('stores/:storeId/analytics/revenue')
  @Roles('admin', 'staff')
  async getRevenueAnalytics(
    @Param('storeId', ParseIntPipe) storeId: number,
    @CurrentUser('sub') userId: number,
    @Query() query: AnalyticsQueryDto,
  ) {
    return this.analyticsService.getRevenueAnalytics(storeId, userId, query);
  }

  @Get('stores/:storeId/analytics/customers')
  @Roles('admin', 'staff')
  async getCustomerAnalytics(
    @Param('storeId', ParseIntPipe) storeId: number,
    @CurrentUser('sub') userId: number,
    @Query() query: AnalyticsQueryDto,
  ) {
    return this.analyticsService.getCustomerAnalytics(storeId, userId, query);
  }

  @Get('stores/:storeId/analytics/staff')
  @Roles('admin')
  async getStaffAnalytics(
    @Param('storeId', ParseIntPipe) storeId: number,
    @CurrentUser('sub') userId: number,
    @Query() query: AnalyticsQueryDto,
  ) {
    return this.analyticsService.getStaffAnalytics(storeId, userId, query);
  }

  @Get('stores/:storeId/analytics/services')
  @Roles('admin', 'staff')
  async getServiceAnalytics(
    @Param('storeId', ParseIntPipe) storeId: number,
    @CurrentUser('sub') userId: number,
    @Query() query: AnalyticsQueryDto,
  ) {
    return this.analyticsService.getServiceAnalytics(storeId, userId, query);
  }
}
