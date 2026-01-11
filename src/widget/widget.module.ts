import { Module } from '@nestjs/common';
import { WidgetController } from './widget.controller';
import { WidgetService } from './services/widget.service';
import { WidgetSettingsRepository } from './repositories/widget-settings.repository';
import { DrizzleModule } from '../db/drizzle.module';
import { AuthModule } from '../auth/auth.module';
import { StoreModule } from '../stores/store.module';
import { ServiceModule } from '../services/service.module';
import { CategoryModule } from '../categories/category.module';
import { LocationModule } from '../locations/location.module';
import { StaffModule } from '../staff/staff.module';
import { AppointmentsModule } from '../appointments/appointments.module';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PublicRateLimitGuard } from '../common/guards/public-rate-limit.guard';
import { EmbedTokenService } from './utils/embed-token';

@Module({
  imports: [
    DrizzleModule,
    AuthModule,
    StoreModule,
    ServiceModule,
    CategoryModule,
    LocationModule,
    StaffModule,
    AppointmentsModule,
    ConfigModule,
  ],
  controllers: [WidgetController],
  providers: [
    WidgetService,
    WidgetSettingsRepository,
    PublicRateLimitGuard,
    {
      provide: EmbedTokenService,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const secret =
          config.get<string>('EMBED_TOKEN_SECRET') ||
          config.get<string>('JWT_SECRET') ||
          'change-me';
        const ttlSeconds = Number(
          config.get<string>('EMBED_TOKEN_TTL_SECONDS') || '900',
        );
        return new EmbedTokenService(secret, ttlSeconds);
      },
    },
  ],
  exports: [
    WidgetService,
    WidgetSettingsRepository,
    PublicRateLimitGuard,
    EmbedTokenService,
  ],
})
export class WidgetModule {}
