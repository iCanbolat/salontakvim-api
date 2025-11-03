import { Exclude, Expose, Type } from 'class-transformer';

class AppointmentExtraResponse {
  @Expose()
  id: number;

  @Expose()
  extraId: number;

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
  id: number;

  @Expose()
  storeId: number;

  @Expose()
  customerId?: number;

  @Expose()
  serviceId?: number;

  @Expose()
  staffId?: number;

  @Expose()
  locationId?: number;

  @Expose()
  @Type(() => GuestInfo)
  guestInfo?: GuestInfo;

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
