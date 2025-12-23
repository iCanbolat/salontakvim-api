import { Expose, Type } from 'class-transformer';

export class DashboardStatsDto {
  @Expose()
  totalAppointments: number;

  @Expose()
  totalRevenue: string;

  @Expose()
  totalCustomers: number;

  @Expose()
  totalStaff: number;

  @Expose()
  appointmentsToday: number;

  @Expose()
  appointmentsTomorrow: number;

  @Expose()
  revenueToday: string;

  @Expose()
  pendingAppointments: number;

  @Expose()
  confirmedAppointments: number;

  @Expose()
  completedAppointments: number;

  @Expose()
  cancelledAppointments: number;

  @Expose()
  noShowAppointments: number;

  @Expose()
  expiredAppointments: number;

  @Expose()
  cancellationRate: string; // percentage

  @Expose()
  averageAppointmentValue: string;

  @Expose()
  popularTimeSlot: string;
}

export class RecentActivityDto {
  @Expose()
  type: 'appointment' | 'customer' | 'staff';

  @Expose()
  message: string;

  @Expose()
  timestamp: Date;

  @Expose()
  metadata?: any;
}

export class DashboardResponseDto {
  @Expose()
  @Type(() => DashboardStatsDto)
  stats: DashboardStatsDto;

  @Expose()
  @Type(() => RecentActivityDto)
  recentActivity: RecentActivityDto[];

  @Expose()
  calculatedAt: Date;
}
