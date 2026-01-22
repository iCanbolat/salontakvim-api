export class CouponResponseDto {
  id: string;
  storeId: string;
  code: string;
  name: string;
  description?: string | null;
  type: 'percentage' | 'fixed_amount';
  value: string;
  minPurchaseAmount?: string | null;
  maxDiscountAmount?: string | null;
  usageLimit?: number | null;
  usageLimitPerCustomer: number;
  usedCount: number;
  validFrom: Date;
  validUntil: Date;
  isActive: boolean;
  applicableServiceIds?: string[] | null;
  createdBy?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export class CustomerCouponResponseDto {
  id: string;
  couponId: string;
  customerId: string;
  storeId: string;
  status: 'active' | 'expired' | 'used' | 'cancelled';
  usedCount: number;
  usedAt?: Date | null;
  notifiedAt?: Date | null;
  assignedBy?: string | null;
  createdAt: Date;
  coupon?: CouponResponseDto;
}

export class CouponWithStatsDto extends CouponResponseDto {
  assignedCount: number;
  totalDiscountGiven: string;
}
