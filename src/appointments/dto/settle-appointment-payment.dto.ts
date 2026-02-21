import { Type } from 'class-transformer';
import { IsBoolean, IsNumber, IsOptional, Min } from 'class-validator';

export class SettleAppointmentPaymentDto {
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  finalTotalPrice: number;

  @IsOptional()
  @IsBoolean()
  markAsPaid?: boolean;
}
