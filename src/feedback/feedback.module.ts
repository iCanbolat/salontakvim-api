import { Module } from '@nestjs/common';
import { FeedbackController } from './feedback.controller';
import { FeedbackService } from './services/feedback.service';
import { FeedbackRepository } from './repositories/feedback.repository';
import { StoreRepository } from '../stores/repositories/store.repository';
import { AppointmentRepository } from '../appointments/repositories/appointment.repository';
import { StaffMemberRepository } from '../staff/repositories/staff-member.repository';
import { ActivitiesModule } from '../activities/activities.module';
import { UserRepository } from '../auth/repositories/user.repository';

@Module({
  imports: [ActivitiesModule],
  controllers: [FeedbackController],
  providers: [
    FeedbackService,
    FeedbackRepository,
    StoreRepository,
    AppointmentRepository,
    StaffMemberRepository,
    UserRepository,
  ],
  exports: [FeedbackService, FeedbackRepository],
})
export class FeedbackModule {}
