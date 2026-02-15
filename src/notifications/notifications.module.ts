import { Module, forwardRef } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { DrizzleModule } from '../db/drizzle.module';
import { AuthModule } from '../auth/auth.module';
import { StoreModule } from '../stores/store.module';
import { NotificationsController } from './notifications.controller';
import { UserNotificationsController } from './user-notifications.controller';
import { NotificationService } from './services/notification.service';
import { EmailService } from './services/email.service';
import { SmsService } from './services/sms.service';
import { TemplateService } from './services/template.service';
import { NotificationRepository } from './repositories/notification.repository';
import { NotificationsGateway } from './notifications.gateway';
import { StaffMemberRepository } from '../staff/repositories/staff-member.repository';
import { AppointmentRepository } from '../appointments/repositories/appointment.repository';
import { StoreRepository } from '../stores/repositories/store.repository';
import { ServiceRepository } from '../services/repositories/service.repository';
import { UserRepository } from '../auth/repositories/user.repository';
import { AppointmentReminderWorker } from './services/appointment-reminder.worker';
import { LocationRepository } from '../locations/repositories/location.repository';

@Module({
  imports: [
    ConfigModule,
    ScheduleModule.forRoot(),
    DrizzleModule,
    forwardRef(() => AuthModule),
    forwardRef(() => StoreModule),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: parseInt(
            configService.get<string>('JWT_ACCESS_TOKEN_EXPIRATION', '86400'),
          ),
        },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [NotificationsController, UserNotificationsController],
  providers: [
    NotificationService,
    EmailService,
    SmsService,
    TemplateService,
    NotificationRepository,
    NotificationsGateway,
    StaffMemberRepository,
    AppointmentRepository,
    StoreRepository,
    ServiceRepository,
    UserRepository,
    LocationRepository,
    AppointmentReminderWorker,
  ],
  exports: [NotificationService, NotificationsGateway, SmsService],
})
export class NotificationsModule {}
