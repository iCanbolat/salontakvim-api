import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
} from 'class-validator';

export enum DayOfWeekEnum {
  Monday = 'monday',
  Tuesday = 'tuesday',
  Wednesday = 'wednesday',
  Thursday = 'thursday',
  Friday = 'friday',
  Saturday = 'saturday',
  Sunday = 'sunday',
}

export class CreateWorkingHoursDto {
  @IsEnum(DayOfWeekEnum)
  @IsNotEmpty()
  dayOfWeek: DayOfWeekEnum;

  @IsString()
  @IsNotEmpty()
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$/, {
    message: 'Start time must be in HH:MM or HH:MM:SS format',
  })
  startTime: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$/, {
    message: 'End time must be in HH:MM or HH:MM:SS format',
  })
  endTime: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
