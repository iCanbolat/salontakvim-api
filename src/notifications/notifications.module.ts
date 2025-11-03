import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DrizzleModule } from '../db/drizzle.module';
import { AuthModule } from '../auth/auth.module';
import { NotificationsController } from './notifications.controller';
import { NotificationService } from './services/notification.service';
import { EmailService } from './services/email.service';
import { SmsService } from './services/sms.service';
import { TemplateService } from './services/template.service';
import { NotificationRepository } from './repositories/notification.repository';

@Module({
  imports: [ConfigModule, DrizzleModule, AuthModule],
  controllers: [NotificationsController],
  providers: [
    NotificationService,
    EmailService,
    SmsService,
    TemplateService,
    NotificationRepository,
  ],
  exports: [NotificationService],
})
export class NotificationsModule {}
