import { Exclude, Expose } from 'class-transformer';

@Exclude()
export class StaffMemberResponseDto {
  @Expose()
  id: number;

  @Expose()
  userId: number;

  @Expose()
  storeId: number;

  @Expose()
  locationId?: number;

  @Expose()
  bio?: string;

  @Expose()
  title?: string;

  @Expose()
  isVisible: boolean;

  @Expose()
  createdAt: Date;

  @Expose()
  updatedAt: Date;

  // User info (from join)
  @Expose()
  email?: string;

  @Expose()
  firstName?: string;

  @Expose()
  lastName?: string;

  @Expose()
  avatar?: string;
}
