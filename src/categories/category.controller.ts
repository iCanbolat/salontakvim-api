import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { CategoryService } from './services/category.service';
import {
  CreateCategoryDto,
  UpdateCategoryDto,
  CategoryResponseDto,
  ReorderCategoriesDto,
} from './dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import type { JwtPayload } from '../auth/interfaces/auth.interface';

@Controller('stores/:storeId/categories')
export class CategoryController {
  constructor(private readonly categoryService: CategoryService) {}

  @Post()
  @Roles('admin', 'staff')
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Param('storeId', ParseIntPipe) storeId: number,
    @CurrentUser() user: JwtPayload,
    @Body() createCategoryDto: CreateCategoryDto,
  ): Promise<CategoryResponseDto> {
    return this.categoryService.create(storeId, user.sub, createCategoryDto);
  }

  @Get()
  @Roles('admin', 'staff')
  async findAll(
    @Param('storeId', ParseIntPipe) storeId: number,
    @CurrentUser() user: JwtPayload,
  ): Promise<CategoryResponseDto[]> {
    return this.categoryService.findAll(storeId, user.sub);
  }

  @Get(':id')
  @Roles('admin', 'staff')
  async findOne(
    @Param('storeId', ParseIntPipe) storeId: number,
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: JwtPayload,
  ): Promise<CategoryResponseDto> {
    return this.categoryService.findOne(storeId, id, user.sub);
  }

  @Patch(':id')
  @Roles('admin', 'staff')
  async update(
    @Param('storeId', ParseIntPipe) storeId: number,
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: JwtPayload,
    @Body() updateCategoryDto: UpdateCategoryDto,
  ): Promise<CategoryResponseDto> {
    return this.categoryService.update(
      storeId,
      id,
      user.sub,
      updateCategoryDto,
    );
  }

  @Delete(':id')
  @Roles('admin', 'staff')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param('storeId', ParseIntPipe) storeId: number,
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: JwtPayload,
  ): Promise<void> {
    return this.categoryService.remove(storeId, id, user.sub);
  }

  @Patch()
  @Roles('admin', 'staff')
  async reorder(
    @Param('storeId', ParseIntPipe) storeId: number,
    @CurrentUser() user: JwtPayload,
    @Body() reorderDto: ReorderCategoriesDto,
  ): Promise<CategoryResponseDto[]> {
    return this.categoryService.reorder(storeId, user.sub, reorderDto);
  }
}
