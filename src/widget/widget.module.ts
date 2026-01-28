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
import { CouponModule } from '../coupons/coupon.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PublicRateLimitGuard } from '../common/guards/public-rate-limit.guard';
import { EmbedTokenService } from './utils/embed-token';
import { RedisModule } from '../redis/redis.module';

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
    CouponModule,
    NotificationsModule,
    ConfigModule,
    RedisModule,
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
        const secretListRaw = config.get<string>('EMBED_TOKEN_SECRETS');
        const secretList = secretListRaw
          ? secretListRaw
              .split(',')
              .map((item) => item.trim())
              .filter(Boolean)
          : [];
        const primarySecret =
          config.get<string>('EMBED_TOKEN_SECRET') ||
          config.get<string>('JWT_SECRET') ||
          'change-me';
        const secrets = secretList.length ? secretList : [primarySecret];
        const ttlSeconds = Number(
          config.get<string>('EMBED_TOKEN_TTL_SECONDS') || '900',
        );
        return new EmbedTokenService(secrets, ttlSeconds);
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
