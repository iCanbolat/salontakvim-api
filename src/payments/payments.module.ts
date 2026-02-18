import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { StoreModule } from '../stores/store.module';
import { AuthModule } from '../auth/auth.module';
import { ServiceModule } from '../services/service.module';
import { CouponModule } from '../coupons/coupon.module';

@Module({
  imports: [ConfigModule, StoreModule, AuthModule, ServiceModule, CouponModule],
  controllers: [PaymentsController],
  providers: [PaymentsService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
