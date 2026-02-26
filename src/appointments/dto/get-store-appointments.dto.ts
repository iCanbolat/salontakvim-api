import { Transform, Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min,
  IsUUID,
  IsArray,
} from 'class-validator';
import { appointmentStatusEnum } from '../../db/schema';

type AppointmentStatus = (typeof appointmentStatusEnum.enumValues)[number];

export class GetStoreAppointmentsDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 10;

  @IsOptional()
  @IsEnum(appointmentStatusEnum.enumValues)
  status?: AppointmentStatus;

  @IsOptional()
  @IsUUID()
  serviceId?: string;

  @IsOptional()
  @IsUUID()
  staffId?: string;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  @Transform(({ value, obj }) => {
    const rawArray = value ?? obj['staffIds[]'];

    // Clean up auxiliary key to satisfy forbidNonWhitelisted
    if (obj && 'staffIds[]' in obj) {
      delete obj['staffIds[]'];
    }

    if (Array.isArray(rawArray)) {
      return rawArray.filter(Boolean);
    }

    if (typeof rawArray === 'string') {
      // Support both comma-separated and repeated param formats
      return rawArray
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
    }

    return [];
  })
  staffIds?: string[];

  // Absorb axios-style staffIds[] key to avoid whitelist errors
  @IsOptional()
  @Transform(() => undefined)
  ['staffIds[]']?: unknown;

  @IsOptional()
  @IsUUID()
  locationId?: string;

  @IsOptional()
  @IsUUID()
  customerId?: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsEnum(['createdAt', 'startDateTime'])
  sortBy?: 'createdAt' | 'startDateTime';

  @IsOptional()
  @IsEnum(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc';

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  prioritizePending?: boolean;
}
