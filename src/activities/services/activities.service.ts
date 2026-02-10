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
    storeId: string,
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

  async getRecentActivities(storeId: string, limit = 20, locationId?: string) {
    return this.activityRepository.findRecentByStoreId(
      storeId,
      limit,
      locationId,
    );
  }

  async getActivitiesPaginated(
    storeId: string,
    page = 1,
    limit = 20,
    type?: string,
    locationId?: string,
  ) {
    return this.activityRepository.findByStoreIdPaginated(
      storeId,
      page,
      limit,
      type,
      locationId,
    );
  }
}
