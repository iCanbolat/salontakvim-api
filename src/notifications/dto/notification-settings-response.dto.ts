import { Expose, Type } from 'class-transformer';
import { NotificationChannel } from './notification-settings.dto';

export class NotificationSettingsResponseDto {
  @Expose()
  id!: number;

  @Expose()
  storeId!: number;

  @Expose()
  appointmentConfirmationEnabled!: boolean;

  @Expose()
  appointmentConfirmationChannel!: NotificationChannel;

  @Expose()
  appointmentReminderEnabled!: boolean;

  @Expose()
  appointmentReminderChannel!: NotificationChannel;

  @Expose()
  reminder24hEnabled!: boolean;

  @Expose()
  reminder1hEnabled!: boolean;

  @Expose()
  appointmentCancellationEnabled!: boolean;

  @Expose()
  appointmentCancellationChannel!: NotificationChannel;

  @Expose()
  appointmentRescheduledEnabled!: boolean;

  @Expose()
  appointmentRescheduledChannel!: NotificationChannel;

  @Expose()
  feedbackRequestSmsEnabled!: boolean;

  @Expose()
  staffInvitationEnabled!: boolean;

  @Expose()
  senderEmail!: string;

  @Expose()
  senderName!: string;

  @Expose()
  replyToEmail?: string;

  @Expose()
  emailProvider!: string;

  @Expose()
  smsProvider?: string;

  @Expose()
  createdAt!: Date;

  @Expose()
  updatedAt!: Date;
}

