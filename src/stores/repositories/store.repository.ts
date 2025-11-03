import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { eq, sql } from 'drizzle-orm';
import { DRIZZLE_ORM } from '../../db/drizzle.module';
import * as schema from '../../db/schema';
import {
  IStoreRepository,
  Store,
  NewStore,
} from '../interfaces/repository.interface';

@Injectable()
export class StoreRepository implements IStoreRepository {
  constructor(
    @Inject(DRIZZLE_ORM)
    private readonly db: any,
  ) {}

  async create(data: NewStore): Promise<Store> {
    const [store] = await this.db
      .insert(schema.stores)
      .values(data)
      .returning();
    return store;
  }

  async findById(id: number): Promise<Store | null> {
    const [store] = await this.db
      .select()
      .from(schema.stores)
      .where(eq(schema.stores.id, id))
      .limit(1);
    return store || null;
  }

  async findBySlug(slug: string): Promise<Store | null> {
    const [store] = await this.db
      .select()
      .from(schema.stores)
      .where(eq(schema.stores.slug, slug))
      .limit(1);
    return store || null;
  }

  async findByOwnerId(ownerId: number): Promise<Store | null> {
    const [store] = await this.db
      .select()
      .from(schema.stores)
      .where(eq(schema.stores.ownerId, ownerId))
      .limit(1);
    return store || null;
  }

  async update(id: number, data: Partial<Store>): Promise<Store> {
    const [updatedStore] = await this.db
      .update(schema.stores)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(schema.stores.id, id))
      .returning();

    if (!updatedStore) {
      throw new NotFoundException(`Store with ID ${id} not found`);
    }

    return updatedStore;
  }

  async delete(id: number): Promise<void> {
    const result = await this.db
      .delete(schema.stores)
      .where(eq(schema.stores.id, id))
      .returning();

    if (result.length === 0) {
      throw new NotFoundException(`Store with ID ${id} not found`);
    }
  }

  async incrementAppointments(id: number): Promise<void> {
    await this.db
      .update(schema.stores)
      .set({
        totalAppointments: sql`${schema.stores.totalAppointments} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(schema.stores.id, id));
  }

  async incrementCustomers(id: number): Promise<void> {
    await this.db
      .update(schema.stores)
      .set({
        totalCustomers: sql`${schema.stores.totalCustomers} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(schema.stores.id, id));
  }

  async updateAnalytics(
    id: number,
    data: {
      totalAppointments?: number;
      totalCustomers?: number;
    },
  ): Promise<Store> {
    const [updatedStore] = await this.db
      .update(schema.stores)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(schema.stores.id, id))
      .returning();

    if (!updatedStore) {
      throw new NotFoundException(`Store with ID ${id} not found`);
    }

    return updatedStore;
  }
}
