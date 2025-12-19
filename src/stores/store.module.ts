import { Module } from '@nestjs/common';
import { StoreController } from './store.controller';
import { StoreService } from './services/store.service';
import { StoreRepository } from './repositories/store.repository';
import { StaffMemberRepository } from '../staff/repositories/staff-member.repository';

@Module({
  controllers: [StoreController],
  providers: [StoreService, StoreRepository, StaffMemberRepository],
  exports: [StoreService, StoreRepository, StaffMemberRepository],
})
export class StoreModule {}
