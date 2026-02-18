import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class SettleAppointmentPaymentDto {
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  finalTotalPrice: number;

  @IsOptional()
  @IsIn(['cash', 'card', 'online', 'stripe', 'paypal'])
  paymentMethod?: 'cash' | 'card' | 'online' | 'stripe' | 'paypal';

  @IsOptional()
  @IsBoolean()
  markAsPaid?: boolean;

  @IsOptional()
  @IsString()
  internalNotes?: string;
}
