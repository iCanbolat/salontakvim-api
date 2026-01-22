import { Exclude, Expose } from 'class-transformer';

@Exclude()
export class StoreResponseDto {
  @Expose()
  id: number;

  @Expose()
  ownerId: number;

  @Expose()
  name: string;

  @Expose()
  slug: string;

  @Expose()
  description?: string;

  @Expose()
  logo?: string;

  @Expose()
  email?: string;

  @Expose()
  phone?: string;

  @Expose()
  currency: string;

  @Expose()
  sendFeedbackViaSms: boolean;

  @Expose()
  totalAppointments: number;

  @Expose()
  totalCustomers: number;

  @Expose()
  isActive: boolean;

  @Expose()
  createdAt: Date;

  @Expose()
  updatedAt: Date;
}
