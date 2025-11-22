import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { eq, sql, and } from 'drizzle-orm';
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
        role: schema.users.role,
        paymentStatus: schema.users.paymentStatus,
        authProvider: schema.users.authProvider,
        providerId: schema.users.providerId,
        isActive: schema.users.isActive,
        emailVerified: schema.users.emailVerified,
        lastLogin: schema.users.lastLogin,
        createdAt: schema.users.createdAt,
        updatedAt: schema.users.updatedAt,
        totalAppointments: sql<number>`COUNT(${schema.appointments.id})`,
        completedAppointments: sql<number>`COUNT(CASE WHEN ${schema.appointments.status} = 'completed' THEN 1 END)`,
        cancelledAppointments: sql<number>`COUNT(CASE WHEN ${schema.appointments.status} = 'cancelled' THEN 1 END)`,
        totalSpent: sql<string>`COALESCE(SUM(CASE WHEN ${schema.appointments.status} = 'completed' THEN ${schema.appointments.totalPrice}::numeric ELSE 0 END), 0)::text`,
        lastAppointmentDate: sql<Date | null>`MAX(${schema.appointments.startDateTime})`,
        nextAppointmentDate: sql<Date | null>`MIN(CASE WHEN ${schema.appointments.startDateTime} > NOW() THEN ${schema.appointments.startDateTime} END)`,
      })
      .from(schema.users)
      .innerJoin(
        schema.appointments,
        and(
          eq(schema.appointments.customerId, schema.users.id),
          eq(schema.appointments.storeId, storeId),
        ),
      )
      .groupBy(
        schema.users.id,
        schema.users.email,
        schema.users.firstName,
        schema.users.lastName,
        schema.users.phone,
        schema.users.avatar,
        schema.users.role,
        schema.users.paymentStatus,
        schema.users.authProvider,
        schema.users.providerId,
        schema.users.isActive,
        schema.users.emailVerified,
        schema.users.lastLogin,
        schema.users.createdAt,
        schema.users.updatedAt,
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
        role: schema.users.role,
        paymentStatus: schema.users.paymentStatus,
        authProvider: schema.users.authProvider,
        providerId: schema.users.providerId,
        isActive: schema.users.isActive,
        emailVerified: schema.users.emailVerified,
        lastLogin: schema.users.lastLogin,
        createdAt: schema.users.createdAt,
        updatedAt: schema.users.updatedAt,
        totalAppointments: sql<number>`COUNT(${schema.appointments.id})`,
        completedAppointments: sql<number>`COUNT(CASE WHEN ${schema.appointments.status} = 'completed' THEN 1 END)`,
        cancelledAppointments: sql<number>`COUNT(CASE WHEN ${schema.appointments.status} = 'cancelled' THEN 1 END)`,
        totalSpent: sql<string>`COALESCE(SUM(CASE WHEN ${schema.appointments.status} = 'completed' THEN ${schema.appointments.totalPrice}::numeric ELSE 0 END), 0)::text`,
        lastAppointmentDate: sql<Date | null>`MAX(${schema.appointments.startDateTime})`,
        nextAppointmentDate: sql<Date | null>`MIN(CASE WHEN ${schema.appointments.startDateTime} > NOW() THEN ${schema.appointments.startDateTime} END)`,
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
        schema.users.role,
        schema.users.paymentStatus,
        schema.users.authProvider,
        schema.users.providerId,
        schema.users.isActive,
        schema.users.emailVerified,
        schema.users.lastLogin,
        schema.users.createdAt,
        schema.users.updatedAt,
      );

    if (!customer) {
      return null;
    }

    const appointments = await this.db
      .select({
        id: schema.appointments.id,
        storeId: schema.appointments.storeId,
        customerId: schema.appointments.customerId,
        serviceId: schema.appointments.serviceId,
        staffId: schema.appointments.staffId,
        locationId: schema.appointments.locationId,
        guestFirstName: schema.appointments.guestFirstName,
        guestLastName: schema.appointments.guestLastName,
        guestEmail: schema.appointments.guestEmail,
        guestPhone: schema.appointments.guestPhone,
        startDateTime: schema.appointments.startDateTime,
        endDateTime: schema.appointments.endDateTime,
        numberOfPeople: schema.appointments.numberOfPeople,
        status: schema.appointments.status,
        totalPrice: schema.appointments.totalPrice,
        paymentMethod: schema.appointments.paymentMethod,
        isPaid: schema.appointments.isPaid,
        paidAt: schema.appointments.paidAt,
        customerNotes: schema.appointments.customerNotes,
        internalNotes: schema.appointments.internalNotes,
        cancelledAt: schema.appointments.cancelledAt,
        cancellationReason: schema.appointments.cancellationReason,
        isRecurring: schema.appointments.isRecurring,
        parentAppointmentId: schema.appointments.parentAppointmentId,
        createdAt: schema.appointments.createdAt,
        updatedAt: schema.appointments.updatedAt,
      })
      .from(schema.appointments)
      .where(
        and(
          eq(schema.appointments.storeId, storeId),
          eq(schema.appointments.customerId, customerId),
        ),
      )
      .orderBy(sql`${schema.appointments.startDateTime} DESC`);

    const formattedAppointments = appointments.map((appointment) => {
      const { guestFirstName, guestLastName, guestEmail, guestPhone, ...rest } =
        appointment;

      const guestInfo =
        guestFirstName || guestLastName || guestEmail
          ? {
              firstName: guestFirstName || '',
              lastName: guestLastName || '',
              email: guestEmail || '',
              phone: guestPhone || undefined,
            }
          : undefined;

      return {
        ...rest,
        guestInfo,
      };
    });

    return {
      customer,
      appointments: formattedAppointments,
    };
  }
}
