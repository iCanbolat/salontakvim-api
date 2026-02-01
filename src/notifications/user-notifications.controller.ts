import {
  Controller,
  Get,
  Patch,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { NotificationService } from './services/notification.service';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class UserNotificationsController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get()
  async getMyNotifications(
    @CurrentUser('sub') userId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
  ) {
    const parsedPageRaw = Number.parseInt(page ?? '', 10);
    const parsedPage = Number.isFinite(parsedPageRaw)
      ? Math.max(1, parsedPageRaw)
      : undefined;

    const parsedLimitRaw = Number.parseInt(limit ?? '', 10);
    const parsedLimit = Number.isFinite(parsedLimitRaw)
      ? Math.max(1, Math.min(parsedLimitRaw, 50))
      : undefined;

    const normalizedStatus =
      status === 'read' || status === 'unread' ? status : 'all';

    if (parsedPage || parsedLimit || status) {
      return this.notificationService.getUserNotificationsPaginated(
        userId,
        parsedPage ?? 1,
        parsedLimit ?? 20,
        normalizedStatus,
      );
    }

    return this.notificationService.getUserNotifications(userId);
  }

  @Patch(':id/read')
  async markAsRead(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('sub') userId: string,
  ) {
    return this.notificationService.markAsRead(id, userId);
  }

  @Patch('read-all')
  async markAllAsRead(@CurrentUser('sub') userId: string) {
    return this.notificationService.markAllAsRead(userId);
  }
}
