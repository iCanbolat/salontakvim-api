import { Exclude, Expose } from 'class-transformer';

@Exclude()
export class ServiceExtraResponseDto {
  @Expose()
  id: number;

  @Expose()
  serviceId: number;

  @Expose()
  name: string;

  @Expose()
  description?: string;

  @Expose()
  price: string;

  @Expose()
  duration: number;

  @Expose()
  maxQuantity: number;

  @Expose()
  position: number;

  @Expose()
  createdAt: Date;

  @Expose()
  updatedAt: Date;
}
