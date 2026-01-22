import { Module } from '@nestjs/common';
import { CouponController } from './coupon.controller';
import { CouponService } from './services/coupon.service';
import { CouponRepository } from './repositories/coupon.repository';
import { StoreRepository } from '../stores/repositories/store.repository';
import { StaffMemberRepository } from '../staff/repositories/staff-member.repository';

@Module({
  controllers: [CouponController],
  providers: [CouponService, CouponRepository, StoreRepository, StaffMemberRepository],
  exports: [CouponService, CouponRepository],
})
export class CouponModule {}
