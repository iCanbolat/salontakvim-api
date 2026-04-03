import { Expose, Type } from 'class-transformer';

class AppointmentExtraResponse {
  @Expose()
  id!: string;

  @Expose()
  extraId!: string;

  @Expose()
  quantity!: number;

  @Expose()
  price!: string;

  @Expose()
  createdAt!: Date;
}

export class AppointmentResponseDto {
  @Expose()
  id!: string;

  @Expose()
  publicNumber!: string;

  @Expose()
  storeId!: string;

  @Expose()
  customerId?: string;

  @Expose()
  customerNumber?: number;

  @Expose()
  serviceId?: string;

  @Expose()
  staffId?: string;

  @Expose()
  locationId?: string;

  @Expose()
  customerName?: string;

  @Expose()
  customerLastName?: string;

  @Expose()
  email?: string;

  @Expose()
  phone?: string;

  @Expose()
  serviceName?: string;

  @Expose()
  staffName?: string;

  @Expose()
  locationName?: string;

  @Expose()
  storeName?: string;

  @Expose()
  startDateTime!: Date;

  @Expose()
  endDateTime!: Date;

  @Expose()
  numberOfPeople!: number;

  @Expose()
  status!: string;

  @Expose()
  totalPrice!: string;

  @Expose()
  depositAmount?: string;

  @Expose()
  remainingAmount?: string;

  @Expose()
  paymentMethod?: string;

  @Expose()
  isPaid!: boolean;

  @Expose()
  paidAt?: Date;

  @Expose()
  customerNotes?: string;

  @Expose()
  internalNotes?: string;

  @Expose()
  cancelledAt?: Date;

  @Expose()
  cancellationReason?: string;

  @Expose()
  isRecurring!: boolean;

  @Expose()
  parentAppointmentId?: number;

  @Expose()
  @Type(() => AppointmentExtraResponse)
  extras?: AppointmentExtraResponse[];

  @Expose()
  createdAt!: Date;

  @Expose()
  updatedAt!: Date;

  @Expose()
  feedback?: any;

  @Expose()
  files?: any[];

  @Expose()
  activities?: any[];

  constructor(partial: Partial<AppointmentResponseDto>) {
    Object.assign(this, partial);
  }
}

