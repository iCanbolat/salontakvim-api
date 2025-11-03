import { Exclude, Expose, Type } from 'class-transformer';

class ServiceExtraResponse {
  @Expose()
  id: number;

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
}

@Exclude()
export class ServiceResponseDto {
  @Expose()
  id: number;

  @Expose()
  storeId: number;

  @Expose()
  categoryId?: number;

  @Expose()
  name: string;

  @Expose()
  description?: string;

  @Expose()
  duration: number;

  @Expose()
  price: string;

  @Expose()
  capacity: number;

  @Expose()
  bufferTimeBefore: number;

  @Expose()
  bufferTimeAfter: number;

  @Expose()
  color?: string;

  @Expose()
  image?: string;

  @Expose()
  isVisible: boolean;

  @Expose()
  showBringingAnyoneOption: boolean;

  @Expose()
  allowRecurring: boolean;

  @Expose()
  position: number;

  @Expose()
  createdAt: Date;

  @Expose()
  updatedAt: Date;

  @Expose()
  @Type(() => ServiceExtraResponse)
  extras?: ServiceExtraResponse[];
}
