import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { eq, sql, and, inArray, desc } from 'drizzle-orm';
import { DRIZZLE_ORM } from '../../db/drizzle.module';
import * as schema from '../../db/schema';
import {
  BaseRepository,
  PaginatedResult,
} from '../../common/repositories/base.repository';
import {
  IStoreRepository,
  Store,
  NewStore,
} from '../interfaces/repository.interface';

@Injectable()
export class StoreRepository
  extends BaseRepository<Store>
  implements IStoreRepository
{
  constructor(
    @Inject(DRIZZLE_ORM)
    protected readonly db: any,
  ) {
    super(db);
  }

  async create(data: NewStore): Promise<Store> {
    const [store] = await this.db
      .insert(schema.stores)
      .values(data)
      .returning();
    return store;
  }

  async findById(id: string): Promise<Store | null> {
    const [store] = await this.db
      .select()
      .from(schema.stores)
      .where(eq(schema.stores.id, id))
      .limit(1);
    return store || null;
  }

  async findByIds(ids: string[]): Promise<Store[]> {
    if (!ids.length) {
      return [];
    }

    return await this.db
      .select()
      .from(schema.stores)
      .where(inArray(schema.stores.id, Array.from(new Set(ids))));
  }

  async findBySlug(slug: string): Promise<Store | null> {
    const [store] = await this.db
      .select()
      .from(schema.stores)
      .where(eq(schema.stores.slug, slug))
      .limit(1);
    return store || null;
  }

  async findByOwnerId(ownerId: string): Promise<Store | null> {
    const [store] = await this.db
      .select()
      .from(schema.stores)
      .where(eq(schema.stores.ownerId, ownerId))
      .limit(1);
    return store || null;
  }

  async findByStripeCustomerId(
    stripeCustomerId: string,
  ): Promise<Store | null> {
    const [store] = await this.db
      .select()
      .from(schema.stores)
      .where(eq(schema.stores.stripeCustomerId, stripeCustomerId))
      .limit(1);
    return store || null;
  }

  async findByStripeSubscriptionId(
    stripeSubscriptionId: string,
  ): Promise<Store | null> {
    const [store] = await this.db
      .select()
      .from(schema.stores)
      .where(eq(schema.stores.stripeSubscriptionId, stripeSubscriptionId))
      .limit(1);
    return store || null;
  }

  async update(id: string, data: Partial<Store>): Promise<Store> {
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

  async delete(id: string): Promise<void> {
    const result = await this.db
      .delete(schema.stores)
      .where(eq(schema.stores.id, id))
      .returning();

    if (result.length === 0) {
      throw new NotFoundException(`Store with ID ${id} not found`);
    }
  }

  async incrementAppointments(id: string): Promise<void> {
    await this.db
      .update(schema.stores)
      .set({
        totalAppointments: sql`${schema.stores.totalAppointments} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(schema.stores.id, id));
  }

  async incrementCustomers(id: string): Promise<void> {
    await this.db
      .update(schema.stores)
      .set({
        totalCustomers: sql`${schema.stores.totalCustomers} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(schema.stores.id, id));
  }

  async ensureStoreCustomer(storeId: string, customerId: string) {
    const [existing] = await this.db
      .select()
      .from(schema.storeCustomers)
      .where(
        and(
          eq(schema.storeCustomers.storeId, storeId),
          eq(schema.storeCustomers.customerId, customerId),
        ),
      )
      .limit(1);

    if (existing) return existing;

    return await this.db.transaction(async (tx) => {
      const [already] = await tx
        .select()
        .from(schema.storeCustomers)
        .where(
          and(
            eq(schema.storeCustomers.storeId, storeId),
            eq(schema.storeCustomers.customerId, customerId),
          ),
        )
        .limit(1);

      if (already) return already;

      const [next] = await tx
        .select({
          nextNumber: sql<number>`COALESCE(MAX(${schema.storeCustomers.publicNumberCounter}), 0) + 1`,
        })
        .from(schema.storeCustomers)
        .where(eq(schema.storeCustomers.storeId, storeId));

      const publicNumberCounter = next?.nextNumber ?? 1;
      const publicNumber = String(publicNumberCounter).padStart(3, '0');

      const [inserted] = await tx
        .insert(schema.storeCustomers)
        .values({
          storeId,
          customerId,
          publicNumberCounter,
          publicNumber,
        })
        .returning();

      await tx
        .update(schema.stores)
        .set({
          totalCustomers: sql`${schema.stores.totalCustomers} + 1`,
          updatedAt: new Date(),
        })
        .where(eq(schema.stores.id, storeId));

      return inserted;
    });
  }

  async updateAnalytics(
    id: string,
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

  async getCustomers(
    storeId: string,
    search?: string,
    options?: {
      staffId?: string;
      locationId?: string;
      page?: number;
      limit?: number;
    },
  ): Promise<PaginatedResult<any>> {
    const pagination = this.normalizePagination(options);
    const searchTerm = search?.trim().toLowerCase();
    const likeTerm = searchTerm ? `%${searchTerm}%` : null;

    const appointmentConditions = [
      eq(schema.appointments.customerId, schema.users.id),
      eq(schema.appointments.storeId, storeId),
    ];

    if (options?.staffId) {
      appointmentConditions.push(
        eq(schema.appointments.staffId, options.staffId),
      );
    }

    if (options?.locationId) {
      appointmentConditions.push(
        eq(schema.appointments.locationId, options.locationId),
      );
    }

    const whereClause =
      searchTerm && likeTerm
        ? sql`(
          LOWER(CONCAT_WS(' ', ${schema.users.firstName}, ${schema.users.lastName})) LIKE ${likeTerm}
          OR LOWER(COALESCE(${schema.users.email}, '')) LIKE ${likeTerm}
          OR LOWER(COALESCE(${schema.users.phone}, '')) LIKE ${likeTerm}
          OR LOWER(COALESCE(${schema.storeCustomers.publicNumber}, '')) LIKE ${likeTerm}
        )`
        : undefined;

    const queryFactory = async (limit: number, offset: number) => {
      let query = this.db
        .select({
          id: schema.users.id,
          publicNumber: schema.storeCustomers.publicNumber,
          email: schema.users.email,
          firstName: schema.users.firstName,
          lastName: schema.users.lastName,
          phone: schema.users.phone,
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
        .innerJoin(schema.appointments, and(...appointmentConditions))
        .leftJoin(
          schema.storeCustomers,
          and(
            eq(schema.storeCustomers.storeId, storeId),
            eq(schema.storeCustomers.customerId, schema.users.id),
          ),
        );

      if (whereClause) {
        query = query.where(whereClause);
      }

      return query
        .groupBy(
          schema.users.id,
          schema.storeCustomers.publicNumber,
          schema.users.email,
          schema.users.firstName,
          schema.users.lastName,
          schema.users.phone,
          schema.users.lastLogin,
          schema.users.createdAt,
          schema.users.updatedAt,
        )
        .orderBy(sql`MAX(${schema.appointments.startDateTime}) DESC`)
        .limit(limit)
        .offset(offset);
    };

    const countFactory = async () => {
      let query = this.db
        .select({
          count: sql<number>`COUNT(DISTINCT ${schema.users.id})`,
        })
        .from(schema.users)
        .innerJoin(schema.appointments, and(...appointmentConditions))
        .leftJoin(
          schema.storeCustomers,
          and(
            eq(schema.storeCustomers.storeId, storeId),
            eq(schema.storeCustomers.customerId, schema.users.id),
          ),
        );

      if (whereClause) {
        query = query.where(whereClause);
      }

      const [result] = await query;
      return Number(result?.count || 0);
    };

    return this.executePaginatedQuery(pagination, queryFactory, countFactory);
  }

  async getCustomerContactsByIds(
    storeId: string,
    customerIds: string[],
    options?: {
      staffId?: string;
      locationId?: string;
    },
  ): Promise<
    Array<{
      id: string;
      firstName: string | null;
      lastName: string | null;
      email: string | null;
      phone: string | null;
    }>
  > {
    const uniqueIds = Array.from(new Set(customerIds));
    if (uniqueIds.length === 0) return [];

    const appointmentConditions = [
      eq(schema.appointments.customerId, schema.users.id),
      eq(schema.appointments.storeId, storeId),
    ];

    if (options?.staffId) {
      appointmentConditions.push(
        eq(schema.appointments.staffId, options.staffId),
      );
    }

    if (options?.locationId) {
      appointmentConditions.push(
        eq(schema.appointments.locationId, options.locationId),
      );
    }

    return this.db
      .select({
        id: schema.users.id,
        firstName: schema.users.firstName,
        lastName: schema.users.lastName,
        email: schema.users.email,
        phone: schema.users.phone,
      })
      .from(schema.users)
      .innerJoin(schema.appointments, and(...appointmentConditions))
      .where(inArray(schema.users.id, uniqueIds))
      .groupBy(
        schema.users.id,
        schema.users.firstName,
        schema.users.lastName,
        schema.users.email,
        schema.users.phone,
      );
  }

  async getCustomerProfile(
    storeId: string,
    customerId: string,
    options?: {
      staffId?: string;
      locationId?: string;
    },
  ) {
    const appointmentConditions = [
      eq(schema.appointments.customerId, schema.users.id),
      eq(schema.appointments.storeId, storeId),
    ];

    if (options?.staffId) {
      appointmentConditions.push(
        eq(schema.appointments.staffId, options.staffId),
      );
    }

    if (options?.locationId) {
      appointmentConditions.push(
        eq(schema.appointments.locationId, options.locationId),
      );
    }

    const [customer] = await this.db
      .select({
        id: schema.users.id,
        publicNumber: schema.storeCustomers.publicNumber,
        email: schema.users.email,
        firstName: schema.users.firstName,
        lastName: schema.users.lastName,
        phone: schema.users.phone,
        emailVerified: schema.users.emailVerified,
        lastLogin: schema.users.lastLogin,
        createdAt: schema.users.createdAt,
        totalAppointments: sql<number>`COUNT(${schema.appointments.id})`,
        completedAppointments: sql<number>`COUNT(CASE WHEN ${schema.appointments.status} = 'completed' THEN 1 END)`,
        cancelledAppointments: sql<number>`COUNT(CASE WHEN ${schema.appointments.status} = 'cancelled' THEN 1 END)`,
        totalSpent: sql<string>`COALESCE(SUM(CASE WHEN ${schema.appointments.status} = 'completed' THEN ${schema.appointments.totalPrice}::numeric ELSE 0 END), 0)::text`,
        lastAppointmentDate: sql<Date | null>`MAX(${schema.appointments.startDateTime})`,
        nextAppointmentDate: sql<Date | null>`MIN(CASE WHEN ${schema.appointments.startDateTime} > NOW() THEN ${schema.appointments.startDateTime} END)`,
      })
      .from(schema.users)
      .leftJoin(
        schema.storeCustomers,
        and(
          eq(schema.storeCustomers.storeId, storeId),
          eq(schema.storeCustomers.customerId, schema.users.id),
        ),
      )
      .leftJoin(schema.appointments, and(...appointmentConditions))
      .where(eq(schema.users.id, customerId))
      .groupBy(
        schema.users.id,
        schema.storeCustomers.publicNumber,
        schema.users.email,
        schema.users.firstName,
        schema.users.lastName,
        schema.users.phone,
        schema.users.lastLogin,
        schema.users.createdAt,
        schema.users.updatedAt,
      )
      .having(
        options?.staffId || options?.locationId
          ? sql`COUNT(${schema.appointments.id}) > 0`
          : sql`TRUE`,
      );

    if (!customer) {
      return null;
    }

    const appointmentFilters = [
      eq(schema.appointments.storeId, storeId),
      eq(schema.appointments.customerId, customerId),
    ];

    if (options?.staffId) {
      appointmentFilters.push(eq(schema.appointments.staffId, options.staffId));
    }

    if (options?.locationId) {
      appointmentFilters.push(
        eq(schema.appointments.locationId, options.locationId),
      );
    }

    const appointments = await this.db
      .select({
        id: schema.appointments.id,
        storeId: schema.appointments.storeId,
        customerId: schema.appointments.customerId,
        serviceId: schema.appointments.serviceId,
        serviceName: schema.services.name,
        staffId: schema.appointments.staffId,
        staffFirstName: schema.users.firstName,
        staffLastName: schema.users.lastName,
        locationId: schema.appointments.locationId,
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
      .leftJoin(
        schema.services,
        eq(schema.appointments.serviceId, schema.services.id),
      )
      .leftJoin(
        schema.staffMembers,
        eq(schema.appointments.staffId, schema.staffMembers.id),
      )
      .leftJoin(schema.users, eq(schema.staffMembers.userId, schema.users.id))
      .where(and(...appointmentFilters))
      .orderBy(sql`${schema.appointments.startDateTime} DESC`);

    const formattedAppointments = appointments.map((appointment) => {
      const { staffFirstName, staffLastName, ...rest } = appointment;

      const staffName =
        staffFirstName || staffLastName
          ? `${staffFirstName || ''} ${staffLastName || ''}`.trim() || undefined
          : undefined;

      return {
        ...rest,
        staffName,
      };
    });

    const smsHistory = await this.db
      .select({
        id: schema.activities.id,
        message: schema.activities.message,
        createdAt: schema.activities.createdAt,
        metadata: schema.activities.metadata,
      })
      .from(schema.activities)
      .where(
        and(
          eq(schema.activities.storeId, storeId),
          eq(schema.activities.type, 'customer'),
          eq(sql<string>`${schema.activities.metadata} ->> 'channel'`, 'sms'),
          eq(
            sql<string>`${schema.activities.metadata} ->> 'customerId'`,
            customerId,
          ),
        ),
      )
      .orderBy(desc(schema.activities.createdAt))
      .limit(50);

    return {
      customer,
      appointments: formattedAppointments,
      smsHistory,
    };
  }
}
