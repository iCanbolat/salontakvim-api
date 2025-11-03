import { Module } from '@nestjs/common';
import { LocationController } from './location.controller';
import { LocationService } from './services/location.service';
import { LocationRepository } from './repositories/location.repository';
import { StoreModule } from '../stores/store.module';

@Module({
  imports: [StoreModule],
  controllers: [LocationController],
  providers: [LocationService, LocationRepository],
  exports: [LocationService, LocationRepository],
})
export class LocationModule {}
