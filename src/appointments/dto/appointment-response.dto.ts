import { Exclude, Expose, Type } from 'class-transformer';

class AppointmentExtraResponse {
  @Expose()
  id: string;

  @Expose()
  extraId: string;

  @Expose()
  quantity: number;

  @Expose()
  price: string;

  @Expose()
  createdAt: Date;
}

class GuestInfo {
  @Expose()
  firstName: string;

  @Expose()
  lastName: string;

  @Expose()
  email: string;

  @Expose()
  phone?: string;
}

export class AppointmentResponseDto {
  @Expose()
  id: string;

  @Expose()
  publicNumber: string;

  @Expose()
  storeId: string;

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
  @Type(() => GuestInfo)
  guestInfo?: GuestInfo;

  @Expose()
  customerName?: string;

  @Expose()
  serviceName?: string;

  @Expose()
  staffName?: string;

  @Expose()
  locationName?: string;

  @Expose()
  storeName?: string;

  @Expose()
  startDateTime: Date;

  @Expose()
  endDateTime: Date;

  @Expose()
  numberOfPeople: number;

  @Expose()
  status: string;

  @Expose()
  totalPrice: string;

  @Expose()
  depositAmount?: string;

  @Expose()
  remainingAmount?: string;

  @Expose()
  paymentMethod?: string;

  @Expose()
  isPaid: boolean;

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
  isRecurring: boolean;

  @Expose()
  parentAppointmentId?: number;

  @Expose()
  @Type(() => AppointmentExtraResponse)
  extras?: AppointmentExtraResponse[];

  @Expose()
  createdAt: Date;

  @Expose()
  updatedAt: Date;

  @Expose()
  feedback?: any;

  @Expose()
  files?: any[];

  @Exclude()
  guestFirstName?: string;

  @Exclude()
  guestLastName?: string;

  @Exclude()
  guestEmail?: string;

  @Exclude()
  guestPhone?: string;

  constructor(partial: Partial<AppointmentResponseDto>) {
    Object.assign(this, partial);

    // Transform guest fields into guestInfo object
    if (this.guestFirstName || this.guestLastName || this.guestEmail) {
      this.guestInfo = {
        firstName: this.guestFirstName!,
        lastName: this.guestLastName!,
        email: this.guestEmail!,
        phone: this.guestPhone,
      };
    }
  }
}
