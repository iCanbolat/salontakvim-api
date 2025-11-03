import { Module } from '@nestjs/common';
import { WidgetController } from './widget.controller';
import { WidgetService } from './services/widget.service';
import { WidgetSettingsRepository } from './repositories/widget-settings.repository';
import { DrizzleModule } from '../db/drizzle.module';
import { AuthModule } from '../auth/auth.module';
import { StoreModule } from '../stores/store.module';
import { ServiceModule } from '../services/service.module';
import { LocationModule } from '../locations/location.module';
import { StaffModule } from '../staff/staff.module';
import { AppointmentsModule } from '../appointments/appointments.module';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    DrizzleModule,
    AuthModule,
    StoreModule,
    ServiceModule,
    LocationModule,
    StaffModule,
    AppointmentsModule,
    ConfigModule,
  ],
  controllers: [WidgetController],
  providers: [WidgetService, WidgetSettingsRepository],
  exports: [WidgetService, WidgetSettingsRepository],
})
export class WidgetModule {}
