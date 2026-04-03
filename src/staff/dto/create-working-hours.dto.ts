import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Validate,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
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

@ValidatorConstraint({ name: 'isTimeBefore', async: false })
export class IsTimeBeforeConstraint implements ValidatorConstraintInterface {
  validate(endTime: string, args: ValidationArguments) {
    const dto = args.object as CreateWorkingHoursDto;
    if (!dto.startTime || !endTime) return true;
    // Normalize to HH:MM for comparison
    const normalize = (t: string) => t.substring(0, 5);
    return normalize(dto.startTime) < normalize(endTime);
  }

  defaultMessage() {
    return 'End time must be after start time';
  }
}

export class CreateWorkingHoursDto {
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

