import { Module } from '@nestjs/common';
import { CategoryController } from './category.controller';
import { CategoryService } from './services/category.service';
import { CategoryRepository } from './repositories/category.repository';
import { StoreModule } from '../stores/store.module';

@Module({
  imports: [StoreModule],
  controllers: [CategoryController],
  providers: [CategoryService, CategoryRepository],
  exports: [CategoryService, CategoryRepository],
})
export class CategoryModule {}
