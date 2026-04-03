import { Expose, Type } from 'class-transformer';

export class ServicePopularityDto {
  @Expose()
  serviceId!: number;

  @Expose()
  serviceName!: string;

  @Expose()
  categoryName!: string;

  @Expose()
  appointmentCount!: number;

  @Expose()
  revenue!: string;

  @Expose()
  averagePrice!: string;

  @Expose()
  percentage!: string;

  @Expose()
  trend!: 'up' | 'down' | 'stable';

  @Expose()
  trendPercentage!: string;
}

export class ServiceByTimeDto {
  @Expose()
  date!: string;

  @Expose()
  serviceId!: number;

  @Expose()
  serviceName!: string;

  @Expose()
  count!: number;

  @Expose()
  revenue!: string;
}

export class ServiceCategoryPerformanceDto {
  @Expose()
  categoryId!: number;

  @Expose()
  categoryName!: string;

  @Expose()
  serviceCount!: number;

  @Expose()
  appointmentCount!: number;

  @Expose()
  revenue!: string;

  @Expose()
  percentage!: string;
}

export class ServiceExtrasAnalyticsDto {
  @Expose()
  extraId!: number;

  @Expose()
  extraName!: string;

  @Expose()
  serviceName!: string;

  @Expose()
  timesAdded!: number;

  @Expose()
  revenue!: string;

  @Expose()
  attachRate!: string; // percentage of appointments that include this extra
}

export class ServiceAnalyticsResponseDto {
  @Expose()
  totalServices!: number;

  @Expose()
  activeServices!: number;

  @Expose()
  totalRevenue!: string;

  @Expose()
  @Type(() => ServicePopularityDto)
  popularity!: ServicePopularityDto[];

  @Expose()
  @Type(() => ServiceByTimeDto)
  byTime!: ServiceByTimeDto[];

  @Expose()
  @Type(() => ServiceCategoryPerformanceDto)
  byCategory!: ServiceCategoryPerformanceDto[];

  @Expose()
  @Type(() => ServiceExtrasAnalyticsDto)
  extras!: ServiceExtrasAnalyticsDto[];

  @Expose()
  startDate!: string;

  @Expose()
  endDate!: string;

  @Expose()
  calculatedAt!: Date;
}

