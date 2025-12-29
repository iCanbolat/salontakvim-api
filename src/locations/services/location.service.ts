import { Injectable, NotFoundException } from '@nestjs/common';
import { LocationRepository } from '../repositories/location.repository';
import { StoreService } from '../../stores/services/store.service';
import {
  CreateLocationDto,
  UpdateLocationDto,
  LocationResponseDto,
} from '../dto';
import { plainToInstance } from 'class-transformer';

@Injectable()
export class LocationService {
  constructor(
    private readonly locationRepository: LocationRepository,
    private readonly storeService: StoreService,
  ) {}

  async create(
    storeId: string,
    userId: string,
    createLocationDto: CreateLocationDto,
  ): Promise<LocationResponseDto> {
    // Verify store ownership
    await this.storeService.verifyStoreOwnership(storeId, userId);

    const location = await this.locationRepository.create({
      ...createLocationDto,
      storeId,
    });

    return plainToInstance(LocationResponseDto, location, {
      excludeExtraneousValues: true,
    });
  }

  async findAll(
    storeId: string,
    userId: string,
  ): Promise<LocationResponseDto[]> {
    // Verify store access
    await this.storeService.validateStoreExists(storeId);

    const locations = await this.locationRepository.findByStoreId(storeId);

    return plainToInstance(LocationResponseDto, locations, {
      excludeExtraneousValues: true,
    });
  }

  async findVisible(storeId: string): Promise<LocationResponseDto[]> {
    // Public endpoint - no auth required
    await this.storeService.validateStoreExists(storeId);

    const locations =
      await this.locationRepository.findVisibleByStoreId(storeId);

    return plainToInstance(LocationResponseDto, locations, {
      excludeExtraneousValues: true,
    });
  }

  async findOne(
    storeId: string,
    locationId: string,
    userId: string,
  ): Promise<LocationResponseDto> {
    // Verify store access
    await this.storeService.validateStoreExists(storeId);

    const location = await this.locationRepository.findByIdAndStoreId(
      locationId,
      storeId,
    );

    if (!location) {
      throw new NotFoundException(
        `Location with ID ${locationId} not found in store ${storeId}`,
      );
    }

    return plainToInstance(LocationResponseDto, location, {
      excludeExtraneousValues: true,
    });
  }

  async update(
    storeId: string,
    locationId: string,
    userId: string,
    updateLocationDto: UpdateLocationDto,
  ): Promise<LocationResponseDto> {
    // Verify store ownership
    await this.storeService.verifyStoreOwnership(storeId, userId);

    // Verify location belongs to store
    const location = await this.locationRepository.findByIdAndStoreId(
      locationId,
      storeId,
    );

    if (!location) {
      throw new NotFoundException(
        `Location with ID ${locationId} not found in store ${storeId}`,
      );
    }

    const updatedLocation = await this.locationRepository.update(
      locationId,
      updateLocationDto,
    );

    return plainToInstance(LocationResponseDto, updatedLocation, {
      excludeExtraneousValues: true,
    });
  }

  async remove(
    storeId: string,
    locationId: string,
    userId: string,
  ): Promise<void> {
    // Verify store ownership
    await this.storeService.verifyStoreOwnership(storeId, userId);

    // Verify location belongs to store
    const location = await this.locationRepository.findByIdAndStoreId(
      locationId,
      storeId,
    );

    if (!location) {
      throw new NotFoundException(
        `Location with ID ${locationId} not found in store ${storeId}`,
      );
    }

    await this.locationRepository.delete(locationId);
  }

  // Helper method for other modules to validate location exists in store
  async validateLocationInStore(
    locationId: string,
    storeId: string,
  ): Promise<void> {
    const location = await this.locationRepository.findByIdAndStoreId(
      locationId,
      storeId,
    );

    if (!location) {
      throw new NotFoundException(
        `Location with ID ${locationId} not found in store ${storeId}`,
      );
    }
  }
}
