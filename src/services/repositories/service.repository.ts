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

  async findById(id: number): Promise<Service | null> {
    const [service] = await this.db
      .select()
      .from(schema.services)
      .where(eq(schema.services.id, id))
      .limit(1);
    return service || null;
  }

  async findByStoreId(storeId: number): Promise<Service[]> {
    return await this.db
      .select()
      .from(schema.services)
      .where(eq(schema.services.storeId, storeId))
      .orderBy(schema.services.position);
  }

  async findByIdAndStoreId(
    id: number,
    storeId: number,
  ): Promise<Service | null> {
    const [service] = await this.db
      .select()
      .from(schema.services)
      .where(
        and(eq(schema.services.id, id), eq(schema.services.storeId, storeId)),
      )
      .limit(1);
    return service || null;
  }

  async findByCategoryId(categoryId: number): Promise<Service[]> {
    return await this.db
      .select()
      .from(schema.services)
      .where(eq(schema.services.categoryId, categoryId))
      .orderBy(schema.services.position);
  }

  async findVisibleByStoreId(storeId: number): Promise<Service[]> {
    return await this.db
      .select()
      .from(schema.services)
      .where(
        and(
          eq(schema.services.storeId, storeId),
          eq(schema.services.isVisible, true),
        ),
      )
      .orderBy(schema.services.position);
  }

  async update(id: number, data: Partial<Service>): Promise<Service> {
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

  async delete(id: number): Promise<void> {
    const result = await this.db
      .delete(schema.services)
      .where(eq(schema.services.id, id))
      .returning();

    if (result.length === 0) {
      throw new NotFoundException(`Service with ID ${id} not found`);
    }
  }

  async getMaxPosition(storeId: number): Promise<number> {
    const [result] = await this.db
      .select()
      .from(schema.services)
      .where(eq(schema.services.storeId, storeId))
      .orderBy(desc(schema.services.position))
      .limit(1);

    return result?.position ?? -1;
  }
}
