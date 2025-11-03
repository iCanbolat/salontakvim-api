import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { ServiceRepository } from '../repositories/service.repository';
import { ServiceExtraRepository } from '../repositories/service-extra.repository';
import { StoreService } from '../../stores/services/store.service';
import { CategoryRepository } from '../../categories/repositories/category.repository';
import {
  CreateServiceDto,
  UpdateServiceDto,
  ServiceResponseDto,
  CreateServiceExtraDto,
  UpdateServiceExtraDto,
  ServiceExtraResponseDto,
} from '../dto';
import { plainToInstance } from 'class-transformer';

@Injectable()
export class ServiceService {
  constructor(
    private readonly serviceRepository: ServiceRepository,
    private readonly serviceExtraRepository: ServiceExtraRepository,
    private readonly storeService: StoreService,
    private readonly categoryRepository: CategoryRepository,
  ) {}

  async create(
    storeId: number,
    userId: number,
    createServiceDto: CreateServiceDto,
  ): Promise<ServiceResponseDto> {
    // Verify store ownership
    await this.storeService.verifyStoreOwnership(storeId, userId);

    // If categoryId provided, verify it belongs to store
    if (createServiceDto.categoryId) {
      const category = await this.categoryRepository.findByIdAndStoreId(
        createServiceDto.categoryId,
        storeId,
      );
      if (!category) {
        throw new BadRequestException(
          `Category with ID ${createServiceDto.categoryId} not found in store ${storeId}`,
        );
      }
    }

    // Get next position
    const maxPosition = await this.serviceRepository.getMaxPosition(storeId);
    const position = createServiceDto.position ?? maxPosition + 1;

    const service = await this.serviceRepository.create({
      ...createServiceDto,
      storeId,
      position,
      price: createServiceDto.price.toString(),
    });

    return plainToInstance(ServiceResponseDto, service, {
      excludeExtraneousValues: true,
    });
  }

  async findAll(
    storeId: number,
    userId: number,
  ): Promise<ServiceResponseDto[]> {
    // Verify store access
    await this.storeService.validateStoreExists(storeId);

    const services = await this.serviceRepository.findByStoreId(storeId);

    return plainToInstance(ServiceResponseDto, services, {
      excludeExtraneousValues: true,
    });
  }

  async findVisible(storeId: number): Promise<ServiceResponseDto[]> {
    // Public endpoint - no auth required
    await this.storeService.validateStoreExists(storeId);

    const services = await this.serviceRepository.findVisibleByStoreId(storeId);

    return plainToInstance(ServiceResponseDto, services, {
      excludeExtraneousValues: true,
    });
  }

  async findOne(
    storeId: number,
    serviceId: number,
    userId: number,
  ): Promise<ServiceResponseDto> {
    // Verify store access
    await this.storeService.validateStoreExists(storeId);

    const service = await this.serviceRepository.findByIdAndStoreId(
      serviceId,
      storeId,
    );

    if (!service) {
      throw new NotFoundException(
        `Service with ID ${serviceId} not found in store ${storeId}`,
      );
    }

    // Get extras for this service
    const extras = await this.serviceExtraRepository.findByServiceId(serviceId);

    return plainToInstance(
      ServiceResponseDto,
      { ...service, extras },
      {
        excludeExtraneousValues: true,
      },
    );
  }

  async update(
    storeId: number,
    serviceId: number,
    userId: number,
    updateServiceDto: UpdateServiceDto,
  ): Promise<ServiceResponseDto> {
    // Verify store ownership
    await this.storeService.verifyStoreOwnership(storeId, userId);

    // Verify service belongs to store
    const service = await this.serviceRepository.findByIdAndStoreId(
      serviceId,
      storeId,
    );

    if (!service) {
      throw new NotFoundException(
        `Service with ID ${serviceId} not found in store ${storeId}`,
      );
    }

    // If categoryId provided, verify it belongs to store
    if (updateServiceDto.categoryId) {
      const category = await this.categoryRepository.findByIdAndStoreId(
        updateServiceDto.categoryId,
        storeId,
      );
      if (!category) {
        throw new BadRequestException(
          `Category with ID ${updateServiceDto.categoryId} not found in store ${storeId}`,
        );
      }
    }

    const updateData: any = { ...updateServiceDto };
    if (updateServiceDto.price !== undefined) {
      updateData.price = updateServiceDto.price.toString();
    }

    const updatedService = await this.serviceRepository.update(
      serviceId,
      updateData,
    );

    return plainToInstance(ServiceResponseDto, updatedService, {
      excludeExtraneousValues: true,
    });
  }

  async remove(
    storeId: number,
    serviceId: number,
    userId: number,
  ): Promise<void> {
    // Verify store ownership
    await this.storeService.verifyStoreOwnership(storeId, userId);

    // Verify service belongs to store
    const service = await this.serviceRepository.findByIdAndStoreId(
      serviceId,
      storeId,
    );

    if (!service) {
      throw new NotFoundException(
        `Service with ID ${serviceId} not found in store ${storeId}`,
      );
    }

    await this.serviceRepository.delete(serviceId);
  }

  // Service Extras methods
  async createExtra(
    storeId: number,
    serviceId: number,
    userId: number,
    createExtraDto: CreateServiceExtraDto,
  ): Promise<ServiceExtraResponseDto> {
    // Verify store ownership
    await this.storeService.verifyStoreOwnership(storeId, userId);

    // Verify service belongs to store
    const service = await this.serviceRepository.findByIdAndStoreId(
      serviceId,
      storeId,
    );

    if (!service) {
      throw new NotFoundException(
        `Service with ID ${serviceId} not found in store ${storeId}`,
      );
    }

    // Get next position
    const maxPosition =
      await this.serviceExtraRepository.getMaxPosition(serviceId);
    const position = createExtraDto.position ?? maxPosition + 1;

    const extra = await this.serviceExtraRepository.create({
      ...createExtraDto,
      serviceId,
      position,
      price: createExtraDto.price.toString(),
    });

    return plainToInstance(ServiceExtraResponseDto, extra, {
      excludeExtraneousValues: true,
    });
  }

  async findAllExtras(
    storeId: number,
    serviceId: number,
    userId: number,
  ): Promise<ServiceExtraResponseDto[]> {
    // Verify store access
    await this.storeService.validateStoreExists(storeId);

    // Verify service belongs to store
    const service = await this.serviceRepository.findByIdAndStoreId(
      serviceId,
      storeId,
    );

    if (!service) {
      throw new NotFoundException(
        `Service with ID ${serviceId} not found in store ${storeId}`,
      );
    }

    const extras = await this.serviceExtraRepository.findByServiceId(serviceId);

    return plainToInstance(ServiceExtraResponseDto, extras, {
      excludeExtraneousValues: true,
    });
  }

  async updateExtra(
    storeId: number,
    serviceId: number,
    extraId: number,
    userId: number,
    updateExtraDto: UpdateServiceExtraDto,
  ): Promise<ServiceExtraResponseDto> {
    // Verify store ownership
    await this.storeService.verifyStoreOwnership(storeId, userId);

    // Verify service belongs to store
    const service = await this.serviceRepository.findByIdAndStoreId(
      serviceId,
      storeId,
    );

    if (!service) {
      throw new NotFoundException(
        `Service with ID ${serviceId} not found in store ${storeId}`,
      );
    }

    // Verify extra belongs to service
    const extra = await this.serviceExtraRepository.findByIdAndServiceId(
      extraId,
      serviceId,
    );

    if (!extra) {
      throw new NotFoundException(
        `Extra with ID ${extraId} not found for service ${serviceId}`,
      );
    }

    const updateData: any = { ...updateExtraDto };
    if (updateExtraDto.price !== undefined) {
      updateData.price = updateExtraDto.price.toString();
    }

    const updatedExtra = await this.serviceExtraRepository.update(
      extraId,
      updateData,
    );

    return plainToInstance(ServiceExtraResponseDto, updatedExtra, {
      excludeExtraneousValues: true,
    });
  }

  async removeExtra(
    storeId: number,
    serviceId: number,
    extraId: number,
    userId: number,
  ): Promise<void> {
    // Verify store ownership
    await this.storeService.verifyStoreOwnership(storeId, userId);

    // Verify service belongs to store
    const service = await this.serviceRepository.findByIdAndStoreId(
      serviceId,
      storeId,
    );

    if (!service) {
      throw new NotFoundException(
        `Service with ID ${serviceId} not found in store ${storeId}`,
      );
    }

    // Verify extra belongs to service
    const extra = await this.serviceExtraRepository.findByIdAndServiceId(
      extraId,
      serviceId,
    );

    if (!extra) {
      throw new NotFoundException(
        `Extra with ID ${extraId} not found for service ${serviceId}`,
      );
    }

    await this.serviceExtraRepository.delete(extraId);
  }

  // Helper method for other modules
  async validateServiceInStore(
    serviceId: number,
    storeId: number,
  ): Promise<void> {
    const service = await this.serviceRepository.findByIdAndStoreId(
      serviceId,
      storeId,
    );

    if (!service) {
      throw new NotFoundException(
        `Service with ID ${serviceId} not found in store ${storeId}`,
      );
    }
  }
}
