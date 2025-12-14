import { Injectable } from '@nestjs/common';
import { NotificationsGateway } from '../../notifications/notifications.gateway';
import { Activity, ActivityType } from '../interfaces/activity.interface';
import { ActivityRepository } from '../repositories/activity.repository';

@Injectable()
export class ActivitiesService {
  constructor(
    private readonly activityRepository: ActivityRepository,
    private readonly notificationsGateway: NotificationsGateway,
  ) {}

  async recordActivity(
    storeId: number,
    type: ActivityType,
    message: string,
    metadata?: Record<string, any>,
  ): Promise<Activity> {
    const activity = await this.activityRepository.create({
      storeId,
      type,
      message,
      metadata,
    });

    this.notificationsGateway.sendToStore(storeId, 'activity', activity);
    return activity;
  }

  async getRecentActivities(storeId: number, limit = 20) {
    return this.activityRepository.findRecentByStoreId(storeId, limit);
  }
}
