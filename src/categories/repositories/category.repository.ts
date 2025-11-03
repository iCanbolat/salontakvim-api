import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { eq, and, desc } from 'drizzle-orm';
import { DRIZZLE_ORM } from '../../db/drizzle.module';
import * as schema from '../../db/schema';
import {
  ICategoryRepository,
  Category,
  NewCategory,
} from '../interfaces/repository.interface';

@Injectable()
export class CategoryRepository implements ICategoryRepository {
  constructor(
    @Inject(DRIZZLE_ORM)
    private readonly db: any,
  ) {}

  async create(data: NewCategory): Promise<Category> {
    const [category] = await this.db
      .insert(schema.categories)
      .values(data)
      .returning();
    return category;
  }

  async findById(id: number): Promise<Category | null> {
    const [category] = await this.db
      .select()
      .from(schema.categories)
      .where(eq(schema.categories.id, id))
      .limit(1);
    return category || null;
  }

  async findByStoreId(storeId: number): Promise<Category[]> {
    return await this.db
      .select()
      .from(schema.categories)
      .where(eq(schema.categories.storeId, storeId))
      .orderBy(schema.categories.position);
  }

  async findByIdAndStoreId(
    id: number,
    storeId: number,
  ): Promise<Category | null> {
    const [category] = await this.db
      .select()
      .from(schema.categories)
      .where(
        and(
          eq(schema.categories.id, id),
          eq(schema.categories.storeId, storeId),
        ),
      )
      .limit(1);
    return category || null;
  }

  async update(id: number, data: Partial<Category>): Promise<Category> {
    const [updatedCategory] = await this.db
      .update(schema.categories)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(schema.categories.id, id))
      .returning();

    if (!updatedCategory) {
      throw new NotFoundException(`Category with ID ${id} not found`);
    }

    return updatedCategory;
  }

  async delete(id: number): Promise<void> {
    const result = await this.db
      .delete(schema.categories)
      .where(eq(schema.categories.id, id))
      .returning();

    if (result.length === 0) {
      throw new NotFoundException(`Category with ID ${id} not found`);
    }
  }

  async reorder(categoryIds: number[], storeId: number): Promise<void> {
    // Update each category with its new position
    await this.db.transaction(async (tx) => {
      for (let i = 0; i < categoryIds.length; i++) {
        await tx
          .update(schema.categories)
          .set({ position: i, updatedAt: new Date() })
          .where(
            and(
              eq(schema.categories.id, categoryIds[i]),
              eq(schema.categories.storeId, storeId),
            ),
          );
      }
    });
  }

  async getMaxPosition(storeId: number): Promise<number> {
    const [result] = await this.db
      .select()
      .from(schema.categories)
      .where(eq(schema.categories.storeId, storeId))
      .orderBy(desc(schema.categories.position))
      .limit(1);

    return result?.position ?? -1;
  }
}
