import { IsEnum, IsNotEmpty, IsString, Matches } from 'class-validator';

export class CreateWorkingHoursDto {
  @IsEnum([
    'monday',
    'tuesday',
    'wednesday',
    'thursday',
    'friday',
    'saturday',
    'sunday',
  ])
  @IsNotEmpty()
  dayOfWeek:
    | 'monday'
    | 'tuesday'
    | 'wednesday'
    | 'thursday'
    | 'friday'
    | 'saturday'
    | 'sunday';

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
}
