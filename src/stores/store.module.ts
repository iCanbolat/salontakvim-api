import { Module, forwardRef } from '@nestjs/common';
import { StoreController } from './store.controller';
import { CustomerFileController } from './customer-file.controller';
import { StoreImageController } from './store-image.controller';
import { StoreService } from './services/store.service';
import { CustomerFileService } from './services/customer-file.service';
import { StoreImageService } from './services/store-image.service';
import { StoreRepository } from './repositories/store.repository';
import { CustomerFileRepository } from './repositories/customer-file.repository';
import { StaffMemberRepository } from '../staff/repositories/staff-member.repository';
import { ActivitiesModule } from '../activities/activities.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { UserRepository } from '../auth/repositories/user.repository';

@Module({
  imports: [
    forwardRef(() => ActivitiesModule),
    forwardRef(() => NotificationsModule),
  ],
  controllers: [StoreController, CustomerFileController, StoreImageController],
  providers: [
    StoreService,
    CustomerFileService,
    StoreImageService,
    StoreRepository,
    CustomerFileRepository,
    StaffMemberRepository,
    UserRepository,
  ],
  exports: [
    StoreService,
    CustomerFileService,
    StoreImageService,
    StoreRepository,
    CustomerFileRepository,
    StaffMemberRepository,
    UserRepository,
  ],
})
export class StoreModule {}
