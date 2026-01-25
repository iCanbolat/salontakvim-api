import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { eq, and, desc } from 'drizzle-orm';
import { DRIZZLE_ORM } from '../../db/drizzle.module';
import * as schema from '../../db/schema';
import {
  IServiceRepository,
  Service,
  NewService,
} from '../interfaces/repository.interface';

@Injectable()
export class ServiceRepository implements IServiceRepository {
  constructor(
    @Inject(DRIZZLE_ORM)
    private readonly db: any,
  ) {}

  async create(data: NewService): Promise<Service> {
    const [service] = await this.db
      .insert(schema.services)
      .values(data)
      .returning();
    return service;
  }

  async findById(id: string): Promise<Service | null> {
    const [service] = await this.db
      .select()
      .from(schema.services)
      .where(eq(schema.services.id, id))
      .limit(1);
    return service || null;
  }

  async findByStoreId(storeId: string): Promise<any[]> {
    return await this.db
      .select({
        id: schema.services.id,
        storeId: schema.services.storeId,
        categoryId: schema.services.categoryId,
        name: schema.services.name,
        description: schema.services.description,
        duration: schema.services.duration,
        price: schema.services.price,
        capacity: schema.services.capacity,
        bufferTimeBefore: schema.services.bufferTimeBefore,
        bufferTimeAfter: schema.services.bufferTimeAfter,
        image: schema.services.image,
        isVisible: schema.services.isVisible,
        showBringingAnyoneOption: schema.services.showBringingAnyoneOption,
        allowRecurring: schema.services.allowRecurring,
        position: schema.services.position,
        createdAt: schema.services.createdAt,
        updatedAt: schema.services.updatedAt,
        categoryColor: schema.categories.color,
      })
      .from(schema.services)
      .leftJoin(
        schema.categories,
        eq(schema.services.categoryId, schema.categories.id),
      )
      .where(eq(schema.services.storeId, storeId))
      .orderBy(schema.services.position);
  }

  async findByIdAndStoreId(id: string, storeId: string): Promise<any | null> {
    const [service] = await this.db
      .select({
        id: schema.services.id,
        storeId: schema.services.storeId,
        categoryId: schema.services.categoryId,
        name: schema.services.name,
        description: schema.services.description,
        duration: schema.services.duration,
        price: schema.services.price,
        capacity: schema.services.capacity,
        bufferTimeBefore: schema.services.bufferTimeBefore,
        bufferTimeAfter: schema.services.bufferTimeAfter,
        image: schema.services.image,
        isVisible: schema.services.isVisible,
        showBringingAnyoneOption: schema.services.showBringingAnyoneOption,
        allowRecurring: schema.services.allowRecurring,
        position: schema.services.position,
        createdAt: schema.services.createdAt,
        updatedAt: schema.services.updatedAt,
        categoryColor: schema.categories.color,
      })
      .from(schema.services)
      .leftJoin(
        schema.categories,
        eq(schema.services.categoryId, schema.categories.id),
      )
      .where(
        and(eq(schema.services.id, id), eq(schema.services.storeId, storeId)),
      )
      .limit(1);
    return service || null;
  }

  async findByCategoryId(categoryId: string): Promise<Service[]> {
    return await this.db
      .select()
      .from(schema.services)
      .where(eq(schema.services.categoryId, categoryId))
      .orderBy(schema.services.position);
  }

  async findVisibleByStoreId(storeId: string): Promise<any[]> {
    return await this.db
      .select({
        id: schema.services.id,
        storeId: schema.services.storeId,
        categoryId: schema.services.categoryId,
        name: schema.services.name,
        description: schema.services.description,
        duration: schema.services.duration,
        price: schema.services.price,
        capacity: schema.services.capacity,
        bufferTimeBefore: schema.services.bufferTimeBefore,
        bufferTimeAfter: schema.services.bufferTimeAfter,
        image: schema.services.image,
        isVisible: schema.services.isVisible,
        showBringingAnyoneOption: schema.services.showBringingAnyoneOption,
        allowRecurring: schema.services.allowRecurring,
        position: schema.services.position,
        createdAt: schema.services.createdAt,
        updatedAt: schema.services.updatedAt,
        categoryColor: schema.categories.color,
      })
      .from(schema.services)
      .leftJoin(
        schema.categories,
        eq(schema.services.categoryId, schema.categories.id),
      )
      .where(
        and(
          eq(schema.services.storeId, storeId),
          eq(schema.services.isVisible, true),
        ),
      )
      .orderBy(schema.services.position);
  }

  async update(id: string, data: Partial<Service>): Promise<Service> {
    const [updatedService] = await this.db
      .update(schema.services)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(schema.services.id, id))
      .returning();

    if (!updatedService) {
      throw new NotFoundException(`Service with ID ${id} not found`);
    }

    return updatedService;
  }

  async delete(id: string): Promise<void> {
    const result = await this.db
      .delete(schema.services)
      .where(eq(schema.services.id, id))
      .returning();

    if (result.length === 0) {
      throw new NotFoundException(`Service with ID ${id} not found`);
    }
  }

  async getMaxPosition(storeId: string): Promise<number> {
    const [result] = await this.db
      .select()
      .from(schema.services)
      .where(eq(schema.services.storeId, storeId))
      .orderBy(desc(schema.services.position))
      .limit(1);

    return result?.position ?? -1;
  }
}
