import {
  Controller,
  Get,
  Patch,
  Post,
  Body,
  Param,
  UseGuards,
  ParseIntPipe,
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

@Controller('stores/:storeId/notifications')
@UseGuards(JwtAuthGuard, RolesGuard)
export class NotificationsController {
  constructor(private readonly notificationService: NotificationService) {}

  /**
   * Get notification settings
   * GET /stores/:storeId/notifications/settings
   */
  @Get('settings')
  @Roles('owner', 'admin')
  async getSettings(
    @Param('storeId', ParseIntPipe) storeId: number,
    @CurrentUser('storeId') userStoreId: number,
  ) {
    if (storeId !== userStoreId) {
      throw new Error('Unauthorized');
    }

    return this.notificationService.getSettings(storeId);
  }

  /**
   * Update notification settings
   * PATCH /stores/:storeId/notifications/settings
   */
  @Patch('settings')
  @Roles('owner', 'admin')
  async updateSettings(
    @Param('storeId', ParseIntPipe) storeId: number,
    @CurrentUser('storeId') userStoreId: number,
    @Body() dto: UpdateNotificationSettingsDto,
  ) {
    if (storeId !== userStoreId) {
      throw new Error('Unauthorized');
    }

    return this.notificationService.updateSettings(storeId, dto);
  }

  /**
   * Get all notification templates
   * GET /stores/:storeId/notifications/templates
   */
  @Get('templates')
  @Roles('owner', 'admin')
  async getTemplates(
    @Param('storeId', ParseIntPipe) storeId: number,
    @CurrentUser('storeId') userStoreId: number,
  ) {
    if (storeId !== userStoreId) {
      throw new Error('Unauthorized');
    }

    return this.notificationService.getAllTemplates(storeId);
  }

  /**
   * Get a specific notification template
   * GET /stores/:storeId/notifications/templates/:type
   */
  @Get('templates/:type')
  @Roles('owner', 'admin')
  async getTemplate(
    @Param('storeId', ParseIntPipe) storeId: number,
    @Param('type') type: string,
    @CurrentUser('storeId') userStoreId: number,
  ) {
    if (storeId !== userStoreId) {
      throw new Error('Unauthorized');
    }

    return this.notificationService.getTemplate(storeId, type);
  }

  /**
   * Update a notification template
   * PATCH /stores/:storeId/notifications/templates/:type
   */
  @Patch('templates/:type')
  @Roles('owner', 'admin')
  async updateTemplate(
    @Param('storeId', ParseIntPipe) storeId: number,
    @Param('type') type: string,
    @CurrentUser('storeId') userStoreId: number,
    @Body() dto: UpdateTemplateDto,
  ) {
    if (storeId !== userStoreId) {
      throw new Error('Unauthorized');
    }

    return this.notificationService.updateTemplate(storeId, type, dto);
  }

  /**
   * Reset template to default
   * POST /stores/:storeId/notifications/templates/:type/reset
   */
  @Post('templates/:type/reset')
  @Roles('owner', 'admin')
  async resetTemplate(
    @Param('storeId', ParseIntPipe) storeId: number,
    @Param('type') type: string,
    @CurrentUser('storeId') userStoreId: number,
  ) {
    if (storeId !== userStoreId) {
      throw new Error('Unauthorized');
    }

    return this.notificationService.resetTemplate(storeId, type);
  }

  /**
   * Test notification sending
   * POST /stores/:storeId/notifications/test
   */
  @Post('test')
  @Roles('owner', 'admin')
  async testNotification(
    @Param('storeId', ParseIntPipe) storeId: number,
    @CurrentUser('storeId') userStoreId: number,
    @Body() dto: TestNotificationDto,
  ) {
    if (storeId !== userStoreId) {
      throw new Error('Unauthorized');
    }

    return this.notificationService.testNotification(storeId, dto);
  }
}
