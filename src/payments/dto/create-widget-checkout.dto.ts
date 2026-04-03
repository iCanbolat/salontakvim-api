import {
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class WidgetCheckoutExtraDto {
  @IsUUID()
  extraId!: string;

  @IsInt()
  @Min(1)
  quantity!: number;
}

export class CreateWidgetCheckoutDto {
  @IsUUID()
  serviceId!: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WidgetCheckoutExtraDto)
  extrasData?: WidgetCheckoutExtraDto[];

  @IsOptional()
  @IsString()
  couponCode?: string;

  @IsOptional()
  @IsString()
  customerEmail?: string;

  @IsOptional()
  @IsIn(['full', 'deposit'])
  amountType?: 'full' | 'deposit';

  @IsOptional()
  @IsInt()
  @Min(1)
  depositPercentage?: number;

  @IsString()
  successUrl!: string;

  @IsString()
  cancelUrl!: string;
}
