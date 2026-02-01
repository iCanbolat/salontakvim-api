import { Module, forwardRef } from '@nestjs/common';
import { DrizzleModule } from '../db/drizzle.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ActivitiesController } from './activities.controller';
import { ActivitiesService } from './services/activities.service';
import { ActivityRepository } from './repositories/activity.repository';
import { ActivitiesCleanupWorker } from './services/activities-cleanup.worker';

@Module({
  imports: [DrizzleModule, forwardRef(() => NotificationsModule)],
  controllers: [ActivitiesController],
  providers: [ActivitiesService, ActivityRepository, ActivitiesCleanupWorker],
  exports: [ActivitiesService, ActivityRepository],
})
export class ActivitiesModule {}
