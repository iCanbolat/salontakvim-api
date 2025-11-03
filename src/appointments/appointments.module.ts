import { Module } from '@nestjs/common';
import { AppointmentsController } from './appointments.controller';
import { AppointmentsService } from './services/appointments.service';
import { AvailabilityService } from './services/availability.service';
import { AppointmentRepository } from './repositories/appointment.repository';
import { AppointmentExtraRepository } from './repositories/appointment-extra.repository';
import { DrizzleModule } from '../db/drizzle.module';
import { AuthModule } from '../auth/auth.module';
import { StaffModule } from '../staff/staff.module';
import { ServiceModule } from '../services/service.module';

@Module({
  imports: [DrizzleModule, AuthModule, StaffModule, ServiceModule],
  controllers: [AppointmentsController],
  providers: [
    AppointmentsService,
    AvailabilityService,
    AppointmentRepository,
    AppointmentExtraRepository,
  ],
  exports: [AppointmentsService, AppointmentRepository],
})
export class AppointmentsModule {}
