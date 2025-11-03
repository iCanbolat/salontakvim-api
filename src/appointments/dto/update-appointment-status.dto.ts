import { IsEnum, IsString, IsOptional } from 'class-validator';

export enum AppointmentStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  CANCELLED = 'cancelled',
  COMPLETED = 'completed',
  NO_SHOW = 'no_show',
}

export class UpdateAppointmentStatusDto {
  @IsEnum(AppointmentStatus)
  status: AppointmentStatus;

  @IsString()
  @IsOptional()
  cancellationReason?: string;

  @IsString()
  @IsOptional()
  internalNotes?: string;
}
