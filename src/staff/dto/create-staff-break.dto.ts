import {
  IsString,
  IsOptional,
  IsNotEmpty,
  IsBoolean,
  Matches,
  IsEnum,
} from 'class-validator';

export enum StaffBreakType {
  PAID_LEAVE = 'paid_leave',
  SICK_LEAVE = 'sick_leave',
  UNPAID_LEAVE = 'unpaid_leave',
  BREAK = 'break',
  OTHER = 'other',
}

export enum StaffBreakStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  DECLINED = 'declined',
}

export class CreateStaffBreakDto {
  @IsEnum(StaffBreakType)
  @IsOptional()
  type?: StaffBreakType;

  @IsEnum(StaffBreakStatus)
  @IsOptional()
  status?: StaffBreakStatus;

  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'Start date must be in YYYY-MM-DD format',
  })
  startDate: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'End date must be in YYYY-MM-DD format',
  })
  endDate: string;

  @IsString()
  @IsOptional()
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$/, {
    message: 'Start time must be in HH:MM or HH:MM:SS format',
  })
  startTime?: string;

  @IsString()
  @IsOptional()
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$/, {
    message: 'End time must be in HH:MM or HH:MM:SS format',
  })
  endTime?: string;

  @IsString()
  @IsOptional()
  reason?: string;

  @IsBoolean()
  @IsOptional()
  isRecurring?: boolean;
}
