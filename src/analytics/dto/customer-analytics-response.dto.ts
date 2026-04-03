import { Expose, Type } from 'class-transformer';

export class CustomerGrowthDto {
  @Expose()
  date!: string;

  @Expose()
  newCustomers!: number;

  @Expose()
  totalCustomers!: number;
}

export class TopCustomerDto {
  @Expose()
  customerId!: number;

  @Expose()
  customerName!: string;

  @Expose()
  customerEmail!: string;

  @Expose()
  appointmentCount!: number;

  @Expose()
  totalSpent!: string;

  @Expose()
  averageSpent!: string;

  @Expose()
  lastAppointmentDate!: Date;
}

export class CustomerRetentionDto {
  @Expose()
  newCustomers!: number;

  @Expose()
  returningCustomers!: number;

  @Expose()
  retentionRate!: string; // percentage

  @Expose()
  averageAppointmentsPerCustomer!: string;
}

export class CustomerBySourceDto {
  @Expose()
  source!: string;

  @Expose()
  count!: number;

  @Expose()
  percentage!: string;
}

export class CustomerAnalyticsResponseDto {
  @Expose()
  totalCustomers!: number;

  @Expose()
  newCustomersInPeriod!: number;

  @Expose()
  activeCustomers!: number;

  @Expose()
  @Type(() => CustomerRetentionDto)
  retention!: CustomerRetentionDto;

  @Expose()
  @Type(() => CustomerGrowthDto)
  growth!: CustomerGrowthDto[];

  @Expose()
  @Type(() => TopCustomerDto)
  topCustomers!: TopCustomerDto[];

  @Expose()
  @Type(() => CustomerBySourceDto)
  bySource!: CustomerBySourceDto[];

  @Expose()
  startDate!: string;

  @Expose()
  endDate!: string;

  @Expose()
  calculatedAt!: Date;
}

