import { Exclude, Expose } from 'class-transformer';

@Exclude()
export class StaffBreakResponseDto {
  @Expose()
  id: number;

  @Expose()
  staffId: number;

  @Expose()
  startDate: string;

  @Expose()
  endDate: string;

  @Expose()
  startTime?: string;

  @Expose()
  endTime?: string;

  @Expose()
  reason?: string;

  @Expose()
  isRecurring: boolean;

  @Expose()
  createdAt: Date;

  @Expose()
  updatedAt: Date;
}
