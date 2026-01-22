import { IsString, IsNotEmpty, IsOptional, IsEnum } from 'class-validator';

export enum TemplateType {
  APPOINTMENT_CONFIRMATION = 'appointment_confirmation',
  APPOINTMENT_REMINDER_24H = 'appointment_reminder_24h',
  APPOINTMENT_REMINDER_1H = 'appointment_reminder_1h',
  APPOINTMENT_CANCELLED = 'appointment_cancelled',
  APPOINTMENT_RESCHEDULED = 'appointment_rescheduled',
  APPOINTMENT_FEEDBACK = 'appointment_feedback',
  STAFF_INVITATION = 'staff_invitation',
  PASSWORD_RESET = 'password_reset',
}

export class UpdateTemplateDto {
  @IsOptional()
  @IsString()
  subject?: string;

  @IsOptional()
  @IsString()
  htmlContent?: string;

  @IsOptional()
  @IsString()
  textContent?: string;

  @IsOptional()
  @IsString()
  smsContent?: string;
}

export class TestNotificationDto {
  @IsNotEmpty()
  @IsEnum(TemplateType)
  templateType: TemplateType;

  @IsNotEmpty()
  @IsString()
  recipient: string; // Email or phone number

  @IsOptional()
  @IsString()
  channel?: 'email' | 'sms' | 'both';
}
