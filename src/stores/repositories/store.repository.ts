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

  async getCustomers(storeId: number) {
    const customers = await this.db
      .select({
        id: schema.users.id,
        email: schema.users.email,
        firstName: schema.users.firstName,
        lastName: schema.users.lastName,
        phone: schema.users.phone,
        avatar: schema.users.avatar,
        createdAt: schema.users.createdAt,
        totalAppointments: sql<number>`COUNT(DISTINCT ${schema.appointments.id})`,
        lastAppointmentDate: sql<Date>`MAX(${schema.appointments.startDateTime})`,
      })
      .from(schema.appointments)
      .innerJoin(
        schema.users,
        eq(schema.appointments.customerId, schema.users.id),
      )
      .where(eq(schema.appointments.storeId, storeId))
      .groupBy(
        schema.users.id,
        schema.users.email,
        schema.users.firstName,
        schema.users.lastName,
        schema.users.phone,
        schema.users.avatar,
        schema.users.createdAt,
      )
      .orderBy(sql`MAX(${schema.appointments.startDateTime}) DESC`);

    return customers;
  }

  async getCustomerProfile(storeId: number, customerId: number) {
    const [customer] = await this.db
      .select({
        id: schema.users.id,
        email: schema.users.email,
        firstName: schema.users.firstName,
        lastName: schema.users.lastName,
        phone: schema.users.phone,
        avatar: schema.users.avatar,
        createdAt: schema.users.createdAt,
        totalAppointments: sql<number>`COUNT(DISTINCT ${schema.appointments.id})`,
        completedAppointments: sql<number>`COUNT(DISTINCT CASE WHEN ${schema.appointments.status} = 'completed' THEN ${schema.appointments.id} END)`,
        cancelledAppointments: sql<number>`COUNT(DISTINCT CASE WHEN ${schema.appointments.status} = 'cancelled' THEN ${schema.appointments.id} END)`,
        totalSpent: sql<number>`COALESCE(SUM(${schema.appointments.totalPrice}), 0)`,
        lastAppointmentDate: sql<Date>`MAX(${schema.appointments.startDateTime})`,
      })
      .from(schema.users)
      .leftJoin(
        schema.appointments,
        sql`${schema.appointments.customerId} = ${schema.users.id} AND ${schema.appointments.storeId} = ${storeId}`,
      )
      .where(eq(schema.users.id, customerId))
      .groupBy(
        schema.users.id,
        schema.users.email,
        schema.users.firstName,
        schema.users.lastName,
        schema.users.phone,
        schema.users.avatar,
        schema.users.createdAt,
      );

    return customer || null;
  }
}
