import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { eq, and, inArray } from 'drizzle-orm';
import { DRIZZLE_ORM } from '../../db/drizzle.module';
import * as schema from '../../db/schema';
import {
  ILocationRepository,
  Location,
  NewLocation,
} from '../interfaces/repository.interface';

@Injectable()
export class LocationRepository implements ILocationRepository {
  constructor(
    @Inject(DRIZZLE_ORM)
    private readonly db: any,
  ) {}

  async create(data: NewLocation): Promise<Location> {
    const [location] = await this.db
      .insert(schema.locations)
      .values(data)
      .returning();
    return location;
  }

  async findById(id: string): Promise<Location | null> {
    const [location] = await this.db
      .select()
      .from(schema.locations)
      .where(eq(schema.locations.id, id))
      .limit(1);
    return location || null;
  }

  async findByIds(ids: string[]): Promise<Location[]> {
    if (!ids.length) {
      return [];
    }

    return await this.db
      .select()
      .from(schema.locations)
      .where(inArray(schema.locations.id, Array.from(new Set(ids))));
  }

  async findByStoreId(storeId: string): Promise<Location[]> {
    return await this.db
      .select()
      .from(schema.locations)
      .where(eq(schema.locations.storeId, storeId));
  }

  async findByIdAndStoreId(
    id: string,
    storeId: string,
  ): Promise<Location | null> {
    const [location] = await this.db
      .select()
      .from(schema.locations)
      .where(
        and(eq(schema.locations.id, id), eq(schema.locations.storeId, storeId)),
      )
      .limit(1);
    return location || null;
  }

  async findVisibleByStoreId(storeId: string): Promise<Location[]> {
    return await this.db
      .select()
      .from(schema.locations)
      .where(
        and(
          eq(schema.locations.storeId, storeId),
          eq(schema.locations.isVisible, true),
        ),
      );
  }

  async update(id: string, data: Partial<Location>): Promise<Location> {
    const [updatedLocation] = await this.db
      .update(schema.locations)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(schema.locations.id, id))
      .returning();

    if (!updatedLocation) {
      throw new NotFoundException(`Location with ID ${id} not found`);
    }

    return updatedLocation;
  }

  async delete(id: string): Promise<void> {
    const result = await this.db
      .delete(schema.locations)
      .where(eq(schema.locations.id, id))
      .returning();

    if (result.length === 0) {
      throw new NotFoundException(`Location with ID ${id} not found`);
    }
  }
}
