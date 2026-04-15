import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { StoreModule } from '../stores/store.module';
import { AuthModule } from '../auth/auth.module';
import { ServiceModule } from '../services/service.module';
import { CouponModule } from '../coupons/coupon.module';
import { RedisModule } from '../redis/redis.module';
import { CreemProvider } from './providers/creem.provider';
import { StorePayoutRepository } from './repositories/store-payout.repository';

@Module({
  imports: [
    ConfigModule,
    StoreModule,
    AuthModule,
    ServiceModule,
    CouponModule,
    RedisModule,
  ],
  controllers: [PaymentsController],
  providers: [PaymentsService, CreemProvider, StorePayoutRepository],
  exports: [PaymentsService],
})
export class PaymentsModule {}
