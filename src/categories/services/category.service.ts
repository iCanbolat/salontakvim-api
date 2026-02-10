import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { CategoryRepository } from '../repositories/category.repository';
import { StoreService } from '../../stores/services/store.service';
import {
  CreateCategoryDto,
  UpdateCategoryDto,
  CategoryResponseDto,
  ReorderCategoriesDto,
} from '../dto';
import { plainToInstance } from 'class-transformer';

@Injectable()
export class CategoryService {
  constructor(
    private readonly categoryRepository: CategoryRepository,
    private readonly storeService: StoreService,
  ) {}

  async create(
    storeId: string,
    userId: string,
    createCategoryDto: CreateCategoryDto,
  ): Promise<CategoryResponseDto> {
    // Verify store ownership
    await this.storeService.verifyStoreOwnership(storeId, userId);

    // Get next position
    const maxPosition = await this.categoryRepository.getMaxPosition(storeId);
    const position = createCategoryDto.position ?? maxPosition + 1;

    const category = await this.categoryRepository.create({
      ...createCategoryDto,
      storeId,
      position,
    });

    return plainToInstance(CategoryResponseDto, category, {
      excludeExtraneousValues: true,
    });
  }

  async findAll(
    storeId: string,
    userId: string,
    locationId?: string,
  ): Promise<CategoryResponseDto[]> {
    // Verify store access (owner or staff)
    await this.storeService.validateStoreExists(storeId);

    let categories: any[];
    if (locationId) {
      categories = await this.categoryRepository.findByStoreIdAndLocationId(
        storeId,
        locationId,
      );
    } else {
      categories = await this.categoryRepository.findByStoreId(storeId);
    }

    return plainToInstance(CategoryResponseDto, categories, {
      excludeExtraneousValues: true,
    });
  }

  async findOne(
    storeId: string,
    categoryId: string,
    userId: string,
  ): Promise<CategoryResponseDto> {
    // Verify store access
    await this.storeService.validateStoreExists(storeId);

    const category = await this.categoryRepository.findByIdAndStoreId(
      categoryId,
      storeId,
    );

    if (!category) {
      throw new NotFoundException(
        `Category with ID ${categoryId} not found in store ${storeId}`,
      );
    }

    return plainToInstance(CategoryResponseDto, category, {
      excludeExtraneousValues: true,
    });
  }

  async update(
    storeId: string,
    categoryId: string,
    userId: string,
    updateCategoryDto: UpdateCategoryDto,
  ): Promise<CategoryResponseDto> {
    // Verify store ownership
    await this.storeService.verifyStoreOwnership(storeId, userId);

    // Verify category belongs to store
    const category = await this.categoryRepository.findByIdAndStoreId(
      categoryId,
      storeId,
    );

    if (!category) {
      throw new NotFoundException(
        `Category with ID ${categoryId} not found in store ${storeId}`,
      );
    }

    const updatedCategory = await this.categoryRepository.update(
      categoryId,
      updateCategoryDto,
    );

    return plainToInstance(CategoryResponseDto, updatedCategory, {
      excludeExtraneousValues: true,
    });
  }

  async remove(
    storeId: string,
    categoryId: string,
    userId: string,
  ): Promise<void> {
    // Verify store ownership
    await this.storeService.verifyStoreOwnership(storeId, userId);

    // Verify category belongs to store
    const category = await this.categoryRepository.findByIdAndStoreId(
      categoryId,
      storeId,
    );

    if (!category) {
      throw new NotFoundException(
        `Category with ID ${categoryId} not found in store ${storeId}`,
      );
    }

    await this.categoryRepository.delete(categoryId);
  }

  async reorder(
    storeId: string,
    userId: string,
    reorderDto: ReorderCategoriesDto,
  ): Promise<CategoryResponseDto[]> {
    // Verify store ownership
    await this.storeService.verifyStoreOwnership(storeId, userId);

    // Verify all categories belong to the store
    const storeCategories =
      await this.categoryRepository.findByStoreId(storeId);
    const storeCategoryIds = storeCategories.map((cat) => cat.id);

    const invalidIds = reorderDto.categoryIds.filter(
      (id) => !storeCategoryIds.includes(id),
    );

    if (invalidIds.length > 0) {
      throw new BadRequestException(
        `Categories with IDs [${invalidIds.join(', ')}] do not belong to store ${storeId}`,
      );
    }

    // Reorder categories
    await this.categoryRepository.reorder(reorderDto.categoryIds, storeId);

    // Return updated list
    return this.findAll(storeId, userId);
  }
}
