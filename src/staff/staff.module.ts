import { Module } from '@nestjs/common';
import { StaffController } from './staff.controller';
import { StaffService } from './services/staff.service';
import { StaffMemberRepository } from './repositories/staff-member.repository';
import { StaffInvitationRepository } from './repositories/staff-invitation.repository';
import { StaffWorkingHoursRepository } from './repositories/staff-working-hours.repository';
import { StaffBreakRepository } from './repositories/staff-break.repository';
import { ServiceStaffRepository } from './repositories/service-staff.repository';
import { AuthModule } from '../auth/auth.module';
import { DrizzleModule } from '../db/drizzle.module';
import { LocationRepository } from '../locations/repositories/location.repository';
import { ServiceRepository } from '../services/repositories/service.repository';
import { ActivitiesModule } from '../activities/activities.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { StoreModule } from '../stores/store.module';

@Module({
  imports: [DrizzleModule, AuthModule, ActivitiesModule, StoreModule, NotificationsModule],
  controllers: [StaffController],
  providers: [
    StaffService,
    StaffMemberRepository,
    StaffInvitationRepository,
    StaffWorkingHoursRepository,
    StaffBreakRepository,
    ServiceStaffRepository,
    LocationRepository,
    ServiceRepository,
  ],
  exports: [
    StaffService,
    StaffMemberRepository,
    StaffInvitationRepository,
    StaffWorkingHoursRepository,
    StaffBreakRepository,
    ServiceStaffRepository,
    LocationRepository,
    ServiceRepository,
  ],
})
export class StaffModule {}
