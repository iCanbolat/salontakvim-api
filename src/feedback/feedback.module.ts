import { Module } from '@nestjs/common';
import { FeedbackController } from './feedback.controller';
import { FeedbackService } from './services/feedback.service';
import { FeedbackRepository } from './repositories/feedback.repository';
import { StoreRepository } from '../stores/repositories/store.repository';
import { AppointmentRepository } from '../appointments/repositories/appointment.repository';
import { StaffMemberRepository } from '../staff/repositories/staff-member.repository';

@Module({
  controllers: [FeedbackController],
  providers: [
    FeedbackService,
    FeedbackRepository,
    StoreRepository,
    AppointmentRepository,
    StaffMemberRepository,
  ],
  exports: [FeedbackService, FeedbackRepository],
})
export class FeedbackModule {}
