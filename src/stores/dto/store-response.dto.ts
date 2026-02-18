import { Exclude, Expose } from 'class-transformer';

@Exclude()
export class StoreResponseDto {
  @Expose()
  id: string;

  @Expose()
  ownerId: string;

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
  country: string;

  @Expose()
  currency: string;

  @Expose()
  paymentStatus: 'freemium' | 'pro' | 'business';

  @Expose()
  stripeCustomerId?: string;

  @Expose()
  stripeSubscriptionId?: string;

  @Expose()
  stripeSubscriptionStatus?: string;

  @Expose()
  stripeConnectAccountId?: string;

  @Expose()
  stripeConnectOnboarded?: boolean;

  @Expose()
  storeImages: string[];

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
