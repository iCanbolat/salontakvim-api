import { Module } from '@nestjs/common';
import { StoreController } from './store.controller';
import { CustomerFileController } from './customer-file.controller';
import { StoreFilesController } from './store-files.controller';
import { StoreService } from './services/store.service';
import { CustomerFileService } from './services/customer-file.service';
import { StoreRepository } from './repositories/store.repository';
import { CustomerFileRepository } from './repositories/customer-file.repository';
import { StaffMemberRepository } from '../staff/repositories/staff-member.repository';

@Module({
  controllers: [StoreController, CustomerFileController, StoreFilesController],
  providers: [
    StoreService,
    CustomerFileService,
    StoreRepository,
    CustomerFileRepository,
    StaffMemberRepository,
  ],
  exports: [
    StoreService,
    CustomerFileService,
    StoreRepository,
    CustomerFileRepository,
    StaffMemberRepository,
  ],
})
export class StoreModule {}
