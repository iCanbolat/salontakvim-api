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

  async findByStaffId(staffId: number): Promise<ServiceStaff[]> {
    return await this.db
      .select()
      .from(schema.serviceStaff)
      .where(eq(schema.serviceStaff.staffId, staffId));
  }

  async findServicesByStaffId(staffId: number): Promise<Service[]> {
    const rows = await this.db
      .select({ service: schema.services })
      .from(schema.serviceStaff)
      .innerJoin(
        schema.services,
        eq(schema.serviceStaff.serviceId, schema.services.id),
      )
      .where(eq(schema.serviceStaff.staffId, staffId))
      .orderBy(asc(schema.services.position));

    return rows.map((row: { service: Service }) => row.service);
  }

  async findByServiceId(serviceId: number): Promise<ServiceStaff[]> {
    return await this.db
      .select()
      .from(schema.serviceStaff)
      .where(eq(schema.serviceStaff.serviceId, serviceId));
  }

  async findServiceIdsByStaffIds(staffIds: number[]): Promise<number[]> {
    if (!staffIds.length) {
      return [];
    }

    const rows = await this.db
      .select({ serviceId: schema.serviceStaff.serviceId })
      .from(schema.serviceStaff)
      .where(inArray(schema.serviceStaff.staffId, staffIds))
      .groupBy(schema.serviceStaff.serviceId);

    return rows.map((row: { serviceId: number }) => row.serviceId);
  }

  async findByServiceAndStaff(
    serviceId: number,
    staffId: number,
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

  async unassign(serviceId: number, staffId: number): Promise<void> {
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

  async unassignAllFromStaff(staffId: number): Promise<void> {
    await this.db
      .delete(schema.serviceStaff)
      .where(eq(schema.serviceStaff.staffId, staffId));
  }
}
