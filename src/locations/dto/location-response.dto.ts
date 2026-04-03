import { Exclude, Expose } from 'class-transformer';

@Exclude()
export class LocationResponseDto {
  @Expose()
  id!: number;

  @Expose()
  storeId!: number;

  @Expose()
  name!: string;

  @Expose()
  address?: string;

  @Expose()
  city?: string;

  @Expose()
  state?: string;

  @Expose()
  zipCode?: string;

  @Expose()
  country?: string;

  @Expose()
  phone?: string;

  @Expose()
  email?: string;

  @Expose()
  latitude?: string;

  @Expose()
  longitude?: string;

  @Expose()
  isVisible!: boolean;

  @Expose()
  createdAt!: Date;

  @Expose()
  updatedAt!: Date;
}

