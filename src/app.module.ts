import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DrizzleModule } from './db/drizzle.module';
import { FileUploadModule } from './common/file-upload';
import { AuthModule } from './auth/auth.module';
import { StoreModule } from './stores/store.module';
import { CategoryModule } from './categories/category.module';
import { LocationModule } from './locations/location.module';
import { ServiceModule } from './services/service.module';
import { StaffModule } from './staff/staff.module';
import { AppointmentsModule } from './appointments/appointments.module';
import { WidgetModule } from './widget/widget.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { NotificationsModule } from './notifications/notifications.module';
import { ActivitiesModule } from './activities/activities.module';
import { CouponModule } from './coupons/coupon.module';
import { FeedbackModule } from './feedback/feedback.module';
import { PaymentsModule } from './payments/payments.module';
import { QueueModule } from './queue/queue.module';
import { FeedbackProcessor } from './queue/processors/feedback.processor';
import { CouponNotificationProcessor } from './queue/processors/coupon-notification.processor';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    ScheduleModule.forRoot(),
    DrizzleModule,
    FileUploadModule,
    AuthModule,
    StoreModule,
    CategoryModule,
    LocationModule,
    ServiceModule,
    StaffModule,
    AppointmentsModule,
    WidgetModule,
    AnalyticsModule,
    NotificationsModule,
    ActivitiesModule,
    CouponModule,
    FeedbackModule,
    PaymentsModule,
    QueueModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    FeedbackProcessor,
    CouponNotificationProcessor,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})
export class AppModule {}
