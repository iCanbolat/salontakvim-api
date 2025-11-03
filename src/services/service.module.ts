import { Module } from '@nestjs/common';
import { ServiceController } from './service.controller';
import { ServiceService } from './services/service.service';
import { ServiceRepository } from './repositories/service.repository';
import { ServiceExtraRepository } from './repositories/service-extra.repository';
import { StoreModule } from '../stores/store.module';
import { CategoryModule } from '../categories/category.module';

@Module({
  imports: [StoreModule, CategoryModule],
  controllers: [ServiceController],
  providers: [ServiceService, ServiceRepository, ServiceExtraRepository],
  exports: [ServiceService, ServiceRepository, ServiceExtraRepository],
})
export class ServiceModule {}
