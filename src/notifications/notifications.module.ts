import { Module } from '@nestjs/common';
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

@Module({
  imports: [
    ConfigModule,
    DrizzleModule,
    AuthModule,
    StoreModule,
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
  ],
  exports: [NotificationService, NotificationsGateway],
})
export class NotificationsModule {}
