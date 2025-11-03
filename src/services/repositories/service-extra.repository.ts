import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { eq, and, desc } from 'drizzle-orm';
import { DRIZZLE_ORM } from '../../db/drizzle.module';
import * as schema from '../../db/schema';
import {
  ServiceExtra,
  NewServiceExtra,
} from '../interfaces/repository.interface';

export interface IServiceExtraRepository {
  create(data: NewServiceExtra): Promise<ServiceExtra>;
  findById(id: number): Promise<ServiceExtra | null>;
  findByServiceId(serviceId: number): Promise<ServiceExtra[]>;
  findByIdAndServiceId(
    id: number,
    serviceId: number,
  ): Promise<ServiceExtra | null>;
  update(id: number, data: Partial<ServiceExtra>): Promise<ServiceExtra>;
  delete(id: number): Promise<void>;
  getMaxPosition(serviceId: number): Promise<number>;
}

@Injectable()
export class ServiceExtraRepository implements IServiceExtraRepository {
  constructor(
    @Inject(DRIZZLE_ORM)
    private readonly db: any,
  ) {}

  async create(data: NewServiceExtra): Promise<ServiceExtra> {
    const [extra] = await this.db
      .insert(schema.serviceExtras)
      .values(data)
      .returning();
    return extra;
  }

  async findById(id: number): Promise<ServiceExtra | null> {
    const [extra] = await this.db
      .select()
      .from(schema.serviceExtras)
      .where(eq(schema.serviceExtras.id, id))
      .limit(1);
    return extra || null;
  }

  async findByServiceId(serviceId: number): Promise<ServiceExtra[]> {
    return await this.db
      .select()
      .from(schema.serviceExtras)
      .where(eq(schema.serviceExtras.serviceId, serviceId))
      .orderBy(schema.serviceExtras.position);
  }

  async findByIdAndServiceId(
    id: number,
    serviceId: number,
  ): Promise<ServiceExtra | null> {
    const [extra] = await this.db
      .select()
      .from(schema.serviceExtras)
      .where(
        and(
          eq(schema.serviceExtras.id, id),
          eq(schema.serviceExtras.serviceId, serviceId),
        ),
      )
      .limit(1);
    return extra || null;
  }

  async update(id: number, data: Partial<ServiceExtra>): Promise<ServiceExtra> {
    const [updatedExtra] = await this.db
      .update(schema.serviceExtras)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(schema.serviceExtras.id, id))
      .returning();

    if (!updatedExtra) {
      throw new NotFoundException(`Service extra with ID ${id} not found`);
    }

    return updatedExtra;
  }

  async delete(id: number): Promise<void> {
    const result = await this.db
      .delete(schema.serviceExtras)
      .where(eq(schema.serviceExtras.id, id))
      .returning();

    if (result.length === 0) {
      throw new NotFoundException(`Service extra with ID ${id} not found`);
    }
  }

  async getMaxPosition(serviceId: number): Promise<number> {
    const [result] = await this.db
      .select()
      .from(schema.serviceExtras)
      .where(eq(schema.serviceExtras.serviceId, serviceId))
      .orderBy(desc(schema.serviceExtras.position))
      .limit(1);

    return result?.position ?? -1;
  }
}
