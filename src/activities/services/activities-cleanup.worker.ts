import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ActivityRepository } from '../repositories/activity.repository';
import { NotificationService } from '../../notifications/services/notification.service';

@Injectable()
export class ActivitiesCleanupWorker {
  private readonly logger = new Logger(ActivitiesCleanupWorker.name);

  constructor(
    private readonly activityRepository: ActivityRepository,
    private readonly notificationService: NotificationService,
  ) {}

  @Cron(CronExpression.EVERY_1ST_DAY_OF_MONTH_AT_MIDNIGHT)
  async handleCleanup() {
    const now = new Date();

    const activityRetentionDays = Number(
      process.env.ACTIVITY_RETENTION_DAYS ?? 60,
    );
    const notificationRetentionDays = Number(
      process.env.INAPP_NOTIFICATION_RETENTION_DAYS ?? 60,
    );

    const activityCutoff = new Date(now);
    activityCutoff.setDate(activityCutoff.getDate() - activityRetentionDays);

    const notificationCutoff = new Date(now);
    notificationCutoff.setDate(
      notificationCutoff.getDate() - notificationRetentionDays,
    );

    const [deletedActivities, deletedNotifications] = await Promise.all([
      this.activityRepository.deleteOlderThan(activityCutoff),
      this.notificationService.deleteInAppNotificationsOlderThan(
        notificationCutoff,
      ),
    ]);

    this.logger.log(
      `Monthly cleanup completed: activities=${deletedActivities}, notifications=${deletedNotifications}`,
    );
  }
}
