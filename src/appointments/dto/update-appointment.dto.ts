import { PartialType, OmitType } from '@nestjs/mapped-types';
import { CreateAppointmentDto } from './create-appointment.dto';
import { IsString, IsOptional, IsEnum } from 'class-validator';
import { AppointmentStatus } from './update-appointment-status.dto';

export class UpdateAppointmentDto extends PartialType(
  OmitType(CreateAppointmentDto, ['extras'] as const),
) {
  @IsEnum(AppointmentStatus)
  @IsOptional()
  status?: AppointmentStatus;

  @IsString()
  @IsOptional()
  internalNotes?: string;
}
