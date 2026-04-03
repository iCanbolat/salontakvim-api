import { Exclude, Expose } from 'class-transformer';

@Exclude()
export class WorkingHoursResponseDto {
  @Expose()
  id!: number;

  @Expose()
  staffId!: number;

  @Expose()
  dayOfWeek!: string;

  @Expose()
  startTime!: string;

  @Expose()
  endTime!: string;

  @Expose()
  isActive!: boolean;

  @Expose()
  createdAt!: Date;

  @Expose()
  updatedAt!: Date;
}

