import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { eq, and } from 'drizzle-orm';
import { DRIZZLE_ORM } from '../../db/drizzle.module';
import * as schema from '../../db/schema';
import {
  ServiceStaff,
  NewServiceStaff,
} from '../interfaces/repository.interface';

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

  async findByServiceId(serviceId: number): Promise<ServiceStaff[]> {
    return await this.db
      .select()
      .from(schema.serviceStaff)
      .where(eq(schema.serviceStaff.serviceId, serviceId));
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
