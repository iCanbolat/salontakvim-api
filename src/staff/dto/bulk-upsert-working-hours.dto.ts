import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Validate,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  DayOfWeekEnum,
  IsTimeBeforeConstraint,
} from './create-working-hours.dto';

export class WorkingHourEntry {
  @IsEnum(DayOfWeekEnum)
  @IsNotEmpty()
  dayOfWeek!: DayOfWeekEnum;

  @IsString()
  @IsNotEmpty()
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$/, {
    message: 'Start time must be in HH:MM or HH:MM:SS format',
  })
  startTime!: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$/, {
    message: 'End time must be in HH:MM or HH:MM:SS format',
  })
  @Validate(IsTimeBeforeConstraint)
  endTime!: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class BulkUpsertWorkingHoursDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WorkingHourEntry)
  schedule!: WorkingHourEntry[];
}

