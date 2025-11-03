import { Module } from '@nestjs/common';
import { StoreController } from './store.controller';
import { StoreService } from './services/store.service';
import { StoreRepository } from './repositories/store.repository';

@Module({
  controllers: [StoreController],
  providers: [StoreService, StoreRepository],
  exports: [StoreService, StoreRepository],
})
export class StoreModule {}
