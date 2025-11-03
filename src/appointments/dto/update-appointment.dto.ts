import { PartialType, OmitType } from '@nestjs/mapped-types';
import { CreateAppointmentDto } from './create-appointment.dto';
import { IsString, IsOptional } from 'class-validator';

export class UpdateAppointmentDto extends PartialType(
  OmitType(CreateAppointmentDto, ['extras'] as const),
) {
  @IsString()
  @IsOptional()
  internalNotes?: string;
}
