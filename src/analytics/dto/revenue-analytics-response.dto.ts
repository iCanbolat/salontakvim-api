import { Expose, Type } from 'class-transformer';

export class RevenueByDateDto {
  @Expose()
  date: string;

  @Expose()
  revenue: string;

  @Expose()
  appointmentCount: number;

  @Expose()
  averageValue: string;
}

export class RevenueByServiceDto {
  @Expose()
  serviceId: number;

  @Expose()
  serviceName: string;

  @Expose()
  revenue: string;

  @Expose()
  appointmentCount: number;

  @Expose()
  percentage: string;
}

export class RevenueByStaffDto {
  @Expose()
  staffId: number;

  @Expose()
  staffName: string;

  @Expose()
  revenue: string;

  @Expose()
  appointmentCount: number;

  @Expose()
  percentage: string;
}

export class RevenueByPaymentMethodDto {
  @Expose()
  paymentMethod: string;

  @Expose()
  revenue: string;

  @Expose()
  appointmentCount: number;

  @Expose()
  percentage: string;
}

export class RevenueSummaryDto {
  @Expose()
  totalRevenue: string;

  @Expose()
  averageAppointmentValue: string;

  @Expose()
  totalAppointments: number;

  @Expose()
  paidAppointments: number;

  @Expose()
  unpaidAppointments: number;

  @Expose()
  collectionRate: string; // percentage
}

export class RevenueAnalyticsResponseDto {
  @Expose()
  @Type(() => RevenueSummaryDto)
  summary: RevenueSummaryDto;

  @Expose()
  @Type(() => RevenueByDateDto)
  byDate: RevenueByDateDto[];

  @Expose()
  @Type(() => RevenueByServiceDto)
  byService: RevenueByServiceDto[];

  @Expose()
  @Type(() => RevenueByStaffDto)
  byStaff: RevenueByStaffDto[];

  @Expose()
  @Type(() => RevenueByPaymentMethodDto)
  byPaymentMethod: RevenueByPaymentMethodDto[];

  @Expose()
  startDate: string;

  @Expose()
  endDate: string;

  @Expose()
  calculatedAt: Date;
}
