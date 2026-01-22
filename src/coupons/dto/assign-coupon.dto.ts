import {
  IsArray,
  IsUUID,
  IsBoolean,
  IsOptional,
  ArrayMinSize,
} from 'class-validator';

export class AssignCouponDto {
  @IsUUID()
  couponId: string;

  @IsArray()
  @IsUUID('4', { each: true })
  @ArrayMinSize(1)
  customerIds: string[];

  @IsBoolean()
  @IsOptional()
  notifyCustomers?: boolean;
}

export class BulkAssignCouponDto {
  @IsArray()
  @IsUUID('4', { each: true })
  @ArrayMinSize(1)
  customerIds: string[];

  @IsBoolean()
  @IsOptional()
  notifyCustomers?: boolean;
}
