import { Exclude, Expose } from 'class-transformer';

@Exclude()
export class StaffInvitationResponseDto {
  @Expose()
  id!: number;

  @Expose()
  storeId!: number;

  @Expose()
  email!: string;

  @Expose()
  token!: string;

  @Expose()
  status!: string;

  @Expose()
  invitedBy?: number;

  @Expose()
  expiresAt!: Date;

  @Expose()
  acceptedAt?: Date;

  @Expose()
  createdAt!: Date;
}

