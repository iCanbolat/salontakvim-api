import { Module } from '@nestjs/common';
import { DrizzleModule } from '../db/drizzle.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ActivitiesController } from './activities.controller';
import { ActivitiesService } from './services/activities.service';
import { ActivityRepository } from './repositories/activity.repository';

@Module({
  imports: [DrizzleModule, NotificationsModule],
  controllers: [ActivitiesController],
  providers: [ActivitiesService, ActivityRepository],
  exports: [ActivitiesService, ActivityRepository],
})
export class ActivitiesModule {}
