import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { StoreRepository } from '../repositories/store.repository';
import { CreateStoreDto, UpdateStoreDto, StoreResponseDto } from '../dto';
import { plainToInstance } from 'class-transformer';
import { Store } from '../interfaces/repository.interface';

@Injectable()
export class StoreService {
  constructor(private readonly storeRepository: StoreRepository) {}

  async create(
    ownerId: number,
    createStoreDto: CreateStoreDto,
  ): Promise<StoreResponseDto> {
    // Check if user already has a store
    const existingStore = await this.storeRepository.findByOwnerId(ownerId);
    if (existingStore) {
      throw new ConflictException('User already owns a store');
    }

    // Check if slug is already taken
    const storeWithSlug = await this.storeRepository.findBySlug(
      createStoreDto.slug,
    );
    if (storeWithSlug) {
      throw new ConflictException(
        `Store with slug '${createStoreDto.slug}' already exists`,
      );
    }

    const store = await this.storeRepository.create({
      ...createStoreDto,
      ownerId,
    });

    return plainToInstance(StoreResponseDto, store, {
      excludeExtraneousValues: true,
    });
  }

  async findById(id: number, userId?: number): Promise<StoreResponseDto> {
    const store = await this.storeRepository.findById(id);
    if (!store) {
      throw new NotFoundException(`Store with ID ${id} not found`);
    }

    return plainToInstance(StoreResponseDto, store, {
      excludeExtraneousValues: true,
    });
  }

  async findBySlug(slug: string): Promise<StoreResponseDto> {
    const store = await this.storeRepository.findBySlug(slug);
    if (!store) {
      throw new NotFoundException(`Store with slug '${slug}' not found`);
    }

    return plainToInstance(StoreResponseDto, store, {
      excludeExtraneousValues: true,
    });
  }

  async findMyStore(ownerId: number): Promise<StoreResponseDto> {
    const store = await this.storeRepository.findByOwnerId(ownerId);
    if (!store) {
      throw new NotFoundException('You do not own any store');
    }

    return plainToInstance(StoreResponseDto, store, {
      excludeExtraneousValues: true,
    });
  }

  async update(
    id: number,
    userId: number,
    updateStoreDto: UpdateStoreDto,
  ): Promise<StoreResponseDto> {
    const store = await this.storeRepository.findById(id);
    if (!store) {
      throw new NotFoundException(`Store with ID ${id} not found`);
    }

    // Check if user is the owner
    if (store.ownerId !== userId) {
      throw new ForbiddenException('You are not the owner of this store');
    }

    // If slug is being updated, check if it's available
    if (updateStoreDto.slug && updateStoreDto.slug !== store.slug) {
      const storeWithSlug = await this.storeRepository.findBySlug(
        updateStoreDto.slug,
      );
      if (storeWithSlug) {
        throw new ConflictException(
          `Store with slug '${updateStoreDto.slug}' already exists`,
        );
      }
    }

    const updatedStore = await this.storeRepository.update(id, updateStoreDto);

    return plainToInstance(StoreResponseDto, updatedStore, {
      excludeExtraneousValues: true,
    });
  }

  async deactivate(id: number, userId: number): Promise<void> {
    const store = await this.storeRepository.findById(id);
    if (!store) {
      throw new NotFoundException(`Store with ID ${id} not found`);
    }

    // Check if user is the owner
    if (store.ownerId !== userId) {
      throw new ForbiddenException('You are not the owner of this store');
    }

    await this.storeRepository.update(id, { isActive: false });
  }

  async delete(id: number, userId: number): Promise<void> {
    const store = await this.storeRepository.findById(id);
    if (!store) {
      throw new NotFoundException(`Store with ID ${id} not found`);
    }

    // Check if user is the owner
    if (store.ownerId !== userId) {
      throw new ForbiddenException('You are not the owner of this store');
    }

    await this.storeRepository.delete(id);
  }

  async getAnalytics(
    id: number,
    userId: number,
  ): Promise<{
    totalAppointments: number;
    totalCustomers: number;
  }> {
    const store = await this.storeRepository.findById(id);
    if (!store) {
      throw new NotFoundException(`Store with ID ${id} not found`);
    }

    // Check if user is the owner or staff
    if (store.ownerId !== userId) {
      throw new ForbiddenException('You do not have access to this store');
    }

    return {
      totalAppointments: store.totalAppointments || 0,
      totalCustomers: store.totalCustomers || 0,
    };
  }

  // Helper method to verify store ownership (for other modules)
  async verifyStoreOwnership(storeId: number, userId: number): Promise<Store> {
    const store = await this.storeRepository.findById(storeId);
    if (!store) {
      throw new NotFoundException(`Store with ID ${storeId} not found`);
    }

    if (store.ownerId !== userId) {
      throw new ForbiddenException('You do not have access to this store');
    }

    return store;
  }

  // Helper method to check if store exists (for other modules)
  async validateStoreExists(storeId: number): Promise<Store> {
    const store = await this.storeRepository.findById(storeId);
    if (!store) {
      throw new NotFoundException(`Store with ID ${storeId} not found`);
    }
    return store;
  }
}
