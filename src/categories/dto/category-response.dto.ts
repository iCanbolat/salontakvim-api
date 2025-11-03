import { Exclude, Expose } from 'class-transformer';

@Exclude()
export class CategoryResponseDto {
  @Expose()
  id: number;

  @Expose()
  storeId: number;

  @Expose()
  name: string;

  @Expose()
  description?: string;

  @Expose()
  color?: string;

  @Expose()
  icon?: string;

  @Expose()
  position: number;

  @Expose()
  isVisible: boolean;

  @Expose()
  createdAt: Date;

  @Expose()
  updatedAt: Date;
}
