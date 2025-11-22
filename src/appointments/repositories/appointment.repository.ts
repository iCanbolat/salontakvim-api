import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { eq, and, gte, lte, lt, gt, ne, sql } from 'drizzle-orm';
import { DRIZZLE_ORM } from '../../db/drizzle.module';
import * as schema from '../../db/schema';
import {
  Appointment,
  NewAppointment,
} from '../interfaces/repository.interface';

@Injectable()
export class AppointmentRepository {
  constructor(
    @Inject(DRIZZLE_ORM)
    private readonly db: any,
  ) {}

  async create(data: NewAppointment): Promise<Appointment> {
    const [appointment] = await this.db
      .insert(schema.appointments)
      .values(data)
      .returning();
    return appointment;
  }

  async findById(id: number): Promise<Appointment | null> {
    const [appointment] = await this.db
      .select()
      .from(schema.appointments)
      .where(eq(schema.appointments.id, id))
      .limit(1);
    return appointment || null;
  }

  async findByIdAndStoreId(
    id: number,
    storeId: number,
  ): Promise<Appointment | null> {
    const [appointment] = await this.db
      .select()
      .from(schema.appointments)
      .where(
        and(
          eq(schema.appointments.id, id),
          eq(schema.appointments.storeId, storeId),
        ),
      )
      .limit(1);
    return appointment || null;
  }

  async findByCustomerId(customerId: number): Promise<Appointment[]> {
    return await this.db
      .select()
      .from(schema.appointments)
      .where(eq(schema.appointments.customerId, customerId))
      .orderBy(sql`${schema.appointments.startDateTime} DESC`);
  }

  async findByStoreId(storeId: number): Promise<Appointment[]> {
    return await this.db
      .select()
      .from(schema.appointments)
      .where(eq(schema.appointments.storeId, storeId))
      .orderBy(sql`${schema.appointments.startDateTime} DESC`);
  }

  async findByStaffIdAndDateRange(
    staffId: number,
    startDate: Date,
    endDate: Date,
  ): Promise<Appointment[]> {
    return await this.db
      .select()
      .from(schema.appointments)
      .where(
        and(
          eq(schema.appointments.staffId, staffId),
          gte(schema.appointments.startDateTime, startDate),
          lte(schema.appointments.startDateTime, endDate),
          sql`${schema.appointments.status} != 'cancelled'`,
        ),
      )
      .orderBy(schema.appointments.startDateTime);
  }

  async findByStoreIdAndDateRange(
    storeId: number,
    startDate: Date,
    endDate: Date,
  ): Promise<Appointment[]> {
    return await this.db
      .select()
      .from(schema.appointments)
      .where(
        and(
          eq(schema.appointments.storeId, storeId),
          gte(schema.appointments.startDateTime, startDate),
          lte(schema.appointments.endDateTime, endDate),
        ),
      )
      .orderBy(schema.appointments.startDateTime);
  }

  async findOverlappingAppointments(
    staffId: number,
    startDateTime: Date,
    endDateTime: Date,
    excludeAppointmentId?: number,
  ): Promise<Appointment[]> {
    const conditions = [
      eq(schema.appointments.staffId, staffId),
      ne(schema.appointments.status, 'cancelled'),
      lt(schema.appointments.startDateTime, endDateTime),
      gt(schema.appointments.endDateTime, startDateTime),
    ];

    if (excludeAppointmentId) {
      conditions.push(ne(schema.appointments.id, excludeAppointmentId));
    }

    return await this.db
      .select()
      .from(schema.appointments)
      .where(and(...conditions));
  }

  async update(id: number, data: Partial<Appointment>): Promise<Appointment> {
    const [updatedAppointment] = await this.db
      .update(schema.appointments)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(schema.appointments.id, id))
      .returning();

    if (!updatedAppointment) {
      throw new NotFoundException(`Appointment with ID ${id} not found`);
    }

    return updatedAppointment;
  }

  async delete(id: number): Promise<void> {
    const result = await this.db
      .delete(schema.appointments)
      .where(eq(schema.appointments.id, id))
      .returning();

    if (result.length === 0) {
      throw new NotFoundException(`Appointment with ID ${id} not found`);
    }
  }

  async incrementStoreAppointmentCount(storeId: number): Promise<void> {
    await this.db
      .update(schema.stores)
      .set({
        totalAppointments: sql`${schema.stores.totalAppointments} + 1`,
      })
      .where(eq(schema.stores.id, storeId));
  }
}
