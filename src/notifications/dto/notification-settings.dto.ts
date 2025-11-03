import {
  IsBoolean,
  IsOptional,
  IsEmail,
  IsString,
  IsEnum,
} from 'class-validator';

export enum NotificationChannel {
  EMAIL = 'email',
  SMS = 'sms',
  BOTH = 'both',
}

export class UpdateNotificationSettingsDto {
  @IsOptional()
  @IsBoolean()
  appointmentConfirmationEnabled?: boolean;

  @IsOptional()
  @IsEnum(NotificationChannel)
  appointmentConfirmationChannel?: NotificationChannel;

  @IsOptional()
  @IsBoolean()
  appointmentReminderEnabled?: boolean;

  @IsOptional()
  @IsEnum(NotificationChannel)
  appointmentReminderChannel?: NotificationChannel;

  @IsOptional()
  @IsBoolean()
  reminder24hEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  reminder1hEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  appointmentCancellationEnabled?: boolean;

  @IsOptional()
  @IsEnum(NotificationChannel)
  appointmentCancellationChannel?: NotificationChannel;

  @IsOptional()
  @IsBoolean()
  appointmentRescheduledEnabled?: boolean;

  @IsOptional()
  @IsEnum(NotificationChannel)
  appointmentRescheduledChannel?: NotificationChannel;

  @IsOptional()
  @IsBoolean()
  staffInvitationEnabled?: boolean;

  @IsOptional()
  @IsEmail()
  senderEmail?: string;

  @IsOptional()
  @IsString()
  senderName?: string;

  @IsOptional()
  @IsString()
  replyToEmail?: string;

  @IsOptional()
  @IsString()
  emailProvider?: string; // 'sendgrid', 'aws-ses', 'smtp'

  @IsOptional()
  @IsString()
  smsProvider?: string; // 'twilio', 'aws-sns'
}
