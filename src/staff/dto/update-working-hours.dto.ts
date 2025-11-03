import { PartialType } from '@nestjs/mapped-types';
import { CreateWorkingHoursDto } from './create-working-hours.dto';
import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateWorkingHoursDto extends PartialType(CreateWorkingHoursDto) {
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
