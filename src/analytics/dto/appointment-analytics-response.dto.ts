import { Expose, Type } from 'class-transformer';

export class AppointmentByStatusDto {
  @Expose()
  status!: string;

  @Expose()
  count!: number;

  @Expose()
  percentage!: string;
}

export class AppointmentByDateDto {
  @Expose()
  date!: string;

  @Expose()
  count!: number;

  @Expose()
  revenue!: string;
}

export class AppointmentByTimeSlotDto {
  @Expose()
  timeSlot!: string;

  @Expose()
  count!: number;

  @Expose()
  percentage!: string;
}

export class AppointmentByServiceDto {
  @Expose()
  serviceId!: number;

  @Expose()
  serviceName!: string;

  @Expose()
  count!: number;

  @Expose()
  revenue!: string;

  @Expose()
  percentage!: string;
}

export class AppointmentByStaffDto {
  @Expose()
  staffId!: number;

  @Expose()
  staffName!: string;

  @Expose()
  count!: number;

  @Expose()
  revenue!: string;

  @Expose()
  percentage!: string;
}

export class AppointmentAnalyticsResponseDto {
  @Expose()
  totalAppointments!: number;

  @Expose()
  totalRevenue!: string;

  @Expose()
  averageAppointmentValue!: string;

  @Expose()
  @Type(() => AppointmentByStatusDto)
  byStatus!: AppointmentByStatusDto[];

  @Expose()
  @Type(() => AppointmentByDateDto)
  byDate!: AppointmentByDateDto[];

  @Expose()
  @Type(() => AppointmentByTimeSlotDto)
  byTimeSlot!: AppointmentByTimeSlotDto[];

  @Expose()
  @Type(() => AppointmentByServiceDto)
  byService!: AppointmentByServiceDto[];

  @Expose()
  @Type(() => AppointmentByStaffDto)
  byStaff!: AppointmentByStaffDto[];

  @Expose()
  startDate!: string;

  @Expose()
  endDate!: string;

  @Expose()
  calculatedAt!: Date;
}

