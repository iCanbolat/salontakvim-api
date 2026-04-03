import { Expose, Type } from 'class-transformer';

export class StaffPerformanceDto {
  @Expose()
  staffId!: number;

  @Expose()
  staffName!: string;

  @Expose()
  appointmentCount!: number;

  @Expose()
  completedAppointments!: number;

  @Expose()
  cancelledAppointments!: number;

  @Expose()
  noShowAppointments!: number;

  @Expose()
  completionRate!: string; // percentage

  @Expose()
  totalRevenue!: string;

  @Expose()
  averageRevenue!: string;

  @Expose()
  utilizationRate!: string; // percentage of available hours used

  @Expose()
  rating?: string; // average rating if reviews exist
}

export class StaffAvailabilityDto {
  @Expose()
  staffId!: number;

  @Expose()
  staffName!: string;

  @Expose()
  totalHours!: number;

  @Expose()
  bookedHours!: number;

  @Expose()
  availableHours!: number;

  @Expose()
  utilizationRate!: string; // percentage
}

export class StaffComparisonDto {
  @Expose()
  metric!: string;

  @Expose()
  topPerformer!: string;

  @Expose()
  topValue!: string;

  @Expose()
  average!: string;
}

export class StaffAnalyticsResponseDto {
  @Expose()
  totalStaff!: number;

  @Expose()
  activeStaff!: number;

  @Expose()
  @Type(() => StaffPerformanceDto)
  performance!: StaffPerformanceDto[];

  @Expose()
  @Type(() => StaffAvailabilityDto)
  availability!: StaffAvailabilityDto[];

  @Expose()
  @Type(() => StaffComparisonDto)
  comparison!: StaffComparisonDto[];

  @Expose()
  startDate!: string;

  @Expose()
  endDate!: string;

  @Expose()
  calculatedAt!: Date;
}

