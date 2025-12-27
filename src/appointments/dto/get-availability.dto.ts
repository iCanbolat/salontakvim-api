import {
  IsInt,
  IsDateString,
  IsOptional,
  IsPositive,
  Min,
} from 'class-validator';

export class GetAvailabilityDto {
  @IsInt()
  @IsPositive()
  serviceId: number;

  @IsInt()
  @IsPositive()
  staffId: number;

  @IsDateString()
  date: string; // Format: YYYY-MM-DD

  @IsInt()
  @IsPositive()
  @IsOptional()
  locationId?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  extrasDurationMinutes?: number;
}
