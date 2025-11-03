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

@Module({
  imports: [DrizzleModule, AuthModule],
  controllers: [StaffController],
  providers: [
    StaffService,
    StaffMemberRepository,
    StaffInvitationRepository,
    StaffWorkingHoursRepository,
    StaffBreakRepository,
    ServiceStaffRepository,
  ],
  exports: [
    StaffService,
    StaffMemberRepository,
    StaffInvitationRepository,
    StaffWorkingHoursRepository,
    StaffBreakRepository,
    ServiceStaffRepository,
  ],
})
export class StaffModule {}
