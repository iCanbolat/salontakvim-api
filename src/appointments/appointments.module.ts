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
import { LocationModule } from '../locations/location.module';
import { StoreModule } from '../stores/store.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ActivitiesModule } from '../activities/activities.module';
import { AppointmentExpirationService } from './services/appointment-expiration.service';
import { AppointmentCleanupService } from './services/appointment-cleanup.service';

@Module({
  imports: [
    DrizzleModule,
    AuthModule,
    StaffModule,
    ServiceModule,
    LocationModule,
    StoreModule,
    NotificationsModule,
    ActivitiesModule,
  ],
  controllers: [AppointmentsController],
  providers: [
    AppointmentsService,
    AvailabilityService,
    AppointmentRepository,
    AppointmentExtraRepository,
    AppointmentExpirationService,
    AppointmentCleanupService,
  ],
  exports: [AppointmentsService, AppointmentRepository],
})
export class AppointmentsModule {}
