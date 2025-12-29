import {
  Controller,
  Get,
  Patch,
  Post,
  Body,
  Param,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { NotificationService } from './services/notification.service';
import {
  UpdateNotificationSettingsDto,
  UpdateTemplateDto,
  TestNotificationDto,
} from './dto';
import { StoreService } from '../stores/services/store.service';

@Controller('stores/:storeId/notifications')
@UseGuards(JwtAuthGuard, RolesGuard)
export class NotificationsController {
  constructor(
    private readonly notificationService: NotificationService,
    private readonly storeService: StoreService,
  ) {}

  /**
   * Get notification settings
   * GET /stores/:storeId/notifications/settings
   */
  @Get('settings')
  @Roles('owner', 'admin')
  async getSettings(
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @CurrentUser('sub') userId: string,
  ) {
    await this.storeService.verifyStoreOwnership(storeId, userId);
    return this.notificationService.getSettings(storeId);
  }

  /**
   * Update notification settings
   * PATCH /stores/:storeId/notifications/settings
   */
  @Patch('settings')
  @Roles('owner', 'admin')
  async updateSettings(
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @CurrentUser('sub') userId: string,
    @Body() dto: UpdateNotificationSettingsDto,
  ) {
    await this.storeService.verifyStoreOwnership(storeId, userId);
    return this.notificationService.updateSettings(storeId, dto);
  }

  /**
   * Get all notification templates
   * GET /stores/:storeId/notifications/templates
   */
  @Get('templates')
  @Roles('owner', 'admin')
  async getTemplates(
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @CurrentUser('sub') userId: string,
  ) {
    await this.storeService.verifyStoreOwnership(storeId, userId);
    return this.notificationService.getAllTemplates(storeId);
  }

  /**
   * Get a specific notification template
   * GET /stores/:storeId/notifications/templates/:type
   */
  @Get('templates/:type')
  @Roles('owner', 'admin')
  async getTemplate(
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Param('type') type: string,
    @CurrentUser('sub') userId: string,
  ) {
    await this.storeService.verifyStoreOwnership(storeId, userId);
    return this.notificationService.getTemplate(storeId, type);
  }

  /**
   * Update a notification template
   * PATCH /stores/:storeId/notifications/templates/:type
   */
  @Patch('templates/:type')
  @Roles('owner', 'admin')
  async updateTemplate(
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Param('type') type: string,
    @CurrentUser('sub') userId: string,
    @Body() dto: UpdateTemplateDto,
  ) {
    await this.storeService.verifyStoreOwnership(storeId, userId);
    return this.notificationService.updateTemplate(storeId, type, dto);
  }

  /**
   * Reset template to default
   * POST /stores/:storeId/notifications/templates/:type/reset
   */
  @Post('templates/:type/reset')
  @Roles('owner', 'admin')
  async resetTemplate(
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Param('type') type: string,
    @CurrentUser('sub') userId: string,
  ) {
    await this.storeService.verifyStoreOwnership(storeId, userId);
    return this.notificationService.resetTemplate(storeId, type);
  }

  /**
   * Test notification sending
   * POST /stores/:storeId/notifications/test
   */
  @Post('test')
  @Roles('owner', 'admin')
  async testNotification(
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @CurrentUser('sub') userId: string,
    @Body() dto: TestNotificationDto,
  ) {
    await this.storeService.verifyStoreOwnership(storeId, userId);
    return this.notificationService.testNotification(storeId, dto);
  }
}
