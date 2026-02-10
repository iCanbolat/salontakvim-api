import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { eq, and, asc, inArray } from 'drizzle-orm';
import { DRIZZLE_ORM } from '../../db/drizzle.module';
import * as schema from '../../db/schema';
import {
  ServiceStaff,
  NewServiceStaff,
} from '../interfaces/repository.interface';
import type { Service } from '../../services/interfaces/repository.interface';

@Injectable()
export class ServiceStaffRepository {
  constructor(
    @Inject(DRIZZLE_ORM)
    private readonly db: any,
  ) {}

  async assign(data: NewServiceStaff): Promise<ServiceStaff> {
    const [serviceStaff] = await this.db
      .insert(schema.serviceStaff)
      .values(data)
      .returning();
    return serviceStaff;
  }

  async findByStaffId(staffId: string): Promise<ServiceStaff[]> {
    return await this.db
      .select()
      .from(schema.serviceStaff)
      .where(eq(schema.serviceStaff.staffId, staffId));
  }

  async findServicesByStaffId(staffId: string): Promise<any[]> {
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
        categoryName: schema.categories.name,
      })
      .from(schema.serviceStaff)
      .innerJoin(
        schema.services,
        eq(schema.serviceStaff.serviceId, schema.services.id),
      )
      .leftJoin(
        schema.categories,
        eq(schema.services.categoryId, schema.categories.id),
      )
      .where(eq(schema.serviceStaff.staffId, staffId))
      .orderBy(asc(schema.services.position));
  }

  async findByServiceId(serviceId: string): Promise<ServiceStaff[]> {
    return await this.db
      .select()
      .from(schema.serviceStaff)
      .where(eq(schema.serviceStaff.serviceId, serviceId));
  }

  async findServiceIdsByStaffIds(staffIds: string[]): Promise<string[]> {
    if (!staffIds.length) {
      return [];
    }

    const rows = await this.db
      .select({ serviceId: schema.serviceStaff.serviceId })
      .from(schema.serviceStaff)
      .where(inArray(schema.serviceStaff.staffId, staffIds))
      .groupBy(schema.serviceStaff.serviceId);

    return rows.map((row: { serviceId: string }) => row.serviceId);
  }

  async findByServiceAndStaff(
    serviceId: string,
    staffId: string,
  ): Promise<ServiceStaff | null> {
    const [serviceStaff] = await this.db
      .select()
      .from(schema.serviceStaff)
      .where(
        and(
          eq(schema.serviceStaff.serviceId, serviceId),
          eq(schema.serviceStaff.staffId, staffId),
        ),
      )
      .limit(1);
    return serviceStaff || null;
  }

  async unassign(serviceId: string, staffId: string): Promise<void> {
    const result = await this.db
      .delete(schema.serviceStaff)
      .where(
        and(
          eq(schema.serviceStaff.serviceId, serviceId),
          eq(schema.serviceStaff.staffId, staffId),
        ),
      )
      .returning();

    if (result.length === 0) {
      throw new NotFoundException(
        `Service-staff assignment not found for service ${serviceId} and staff ${staffId}`,
      );
    }
  }

  async unassignAllFromStaff(staffId: string): Promise<void> {
    await this.db
      .delete(schema.serviceStaff)
      .where(eq(schema.serviceStaff.staffId, staffId));
  }
}
