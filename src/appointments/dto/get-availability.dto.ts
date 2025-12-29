import { IsInt, IsDateString, IsOptional, Min, IsUUID } from 'class-validator';

export class GetAvailabilityDto {
  @IsUUID()
  serviceId: string;

  @IsUUID()
  staffId: string;

  @IsDateString()
  date: string; // Format: YYYY-MM-DD

  @IsUUID()
  @IsOptional()
  locationId?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  extrasDurationMinutes?: number;
}
