import { Expose } from 'class-transformer';

export class TimeSlotDto {
  @Expose()
  startTime: string; // Format: HH:MM

  @Expose()
  endTime: string; // Format: HH:MM

  @Expose()
  available: boolean;

  @Expose()
  reason?: string; // Why not available (e.g., "Staff on break", "Already booked")
}

export class AvailabilityResponseDto {
  @Expose()
  date: string; // Format: YYYY-MM-DD

  @Expose()
  serviceId: number;

  @Expose()
  staffId: number;

  @Expose()
  locationId?: number;

  @Expose()
  extrasDurationMinutes?: number;

  @Expose()
  slots: TimeSlotDto[];
}
