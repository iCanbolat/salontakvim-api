import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  eq,
  and,
  gte,
  lte,
  lt,
  gt,
  ne,
  sql,
  SQL,
  inArray,
  or,
} from 'drizzle-orm';
import { DRIZZLE_ORM } from '../../db/drizzle.module';
import * as schema from '../../db/schema';
import {
  Appointment,
  NewAppointment,
} from '../interfaces/repository.interface';
import {
  BaseRepository,
  PaginatedResult,
} from '../../common/repositories/base.repository';

type AppointmentStatusType =
  (typeof schema.appointmentStatusEnum.enumValues)[number];

export interface AppointmentQueryFilters {
  status?: AppointmentStatusType;
  serviceId?: string;
  staffId?: string;
  staffIds?: string[];
  locationId?: string;
  customerId?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export type AppointmentStatusCounts = Record<
  AppointmentStatusType | 'all',
  number
>;

@Injectable()
export class AppointmentRepository extends BaseRepository<Appointment> {
  constructor(
    @Inject(DRIZZLE_ORM)
    db: any,
  ) {
    super(db);
  }

  async create(
    data: Omit<NewAppointment, 'publicNumber' | 'publicNumberCounter'>,
  ): Promise<Appointment> {
    return await this.db.transaction(async (tx) => {
      const [next] = await tx
        .select({
          nextNumber: sql<number>`COALESCE(MAX(${schema.appointments.publicNumberCounter}), 0) + 1`,
        })
        .from(schema.appointments)
        .where(eq(schema.appointments.storeId, data.storeId));

      const publicNumberCounter = next?.nextNumber ?? 1;
      const publicNumber = String(publicNumberCounter).padStart(2, '0');

      const [appointment] = await tx
        .insert(schema.appointments)
        .values({
          ...data,
          publicNumber,
          publicNumberCounter,
        })
        .returning();

      return appointment;
    });
  }

  async findById(id: string): Promise<Appointment | null> {
    const [appointment] = await this.db
      .select()
      .from(schema.appointments)
      .where(eq(schema.appointments.id, id))
      .limit(1);
    return appointment || null;
  }

  async findByIdAndStoreId(
    id: string,
    storeId: string,
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

  async findByCancelToken(token: string): Promise<Appointment | null> {
    const [appointment] = await this.db
      .select()
      .from(schema.appointments)
      .where(eq(schema.appointments.cancelToken, token))
      .limit(1);
    return appointment || null;
  }

  async findByCustomerId(customerId: string): Promise<Appointment[]> {
    return await this.db
      .select()
      .from(schema.appointments)
      .where(eq(schema.appointments.customerId, customerId))
      .orderBy(sql`${schema.appointments.startDateTime} DESC`);
  }

  async findByStoreId(storeId: string): Promise<Appointment[]> {
    return await this.db
      .select()
      .from(schema.appointments)
      .where(eq(schema.appointments.storeId, storeId))
      .orderBy(
        sql`CASE WHEN ${schema.appointments.status} = 'pending' THEN 0 ELSE 1 END ASC`,
        schema.appointments.startDateTime,
      );
  }

  async findByStoreIdWithFilters(
    storeId: string,
    filters: AppointmentQueryFilters = {},
  ): Promise<PaginatedResult<Appointment>> {
    const pagination = this.normalizePagination(filters, 10, 100);
    const whereCondition = this.buildWhereClause(storeId, filters);

    const queryFactory = (limit: number, offset: number) => {
      let query = this.db
        .select()
        .from(schema.appointments)
        .orderBy(
          sql`CASE WHEN ${schema.appointments.status} = 'pending' THEN 0 ELSE 1 END`,
          schema.appointments.startDateTime,
        )
        .limit(limit)
        .offset(offset);

      if (whereCondition) {
        query = query.where(whereCondition);
      }

      return query;
    };

    const countFactory = async () => {
      let countQuery = this.db
        .select({ count: sql<number>`count(*)` })
        .from(schema.appointments);

      if (whereCondition) {
        countQuery = countQuery.where(whereCondition);
      }

      const [countResult] = await countQuery;
      return countResult ? Number(countResult.count) : 0;
    };

    return this.executePaginatedQuery(pagination, queryFactory, countFactory);
  }

  async countByStatus(
    storeId: string,
    filters: AppointmentQueryFilters = {},
  ): Promise<AppointmentStatusCounts> {
    const whereCondition = this.buildWhereClause(storeId, filters, {
      includeStatus: false,
    });

    let query = this.db
      .select({
        status: schema.appointments.status,
        count: sql<number>`count(*)`,
      })
      .from(schema.appointments)
      .groupBy(schema.appointments.status);

    if (whereCondition) {
      query = query.where(whereCondition);
    }

    const rows = await query;

    const counts: AppointmentStatusCounts = {
      all: 0,
      pending: 0,
      confirmed: 0,
      completed: 0,
      cancelled: 0,
      no_show: 0,
      expired: 0,
    };

    for (const row of rows) {
      const status = row.status as AppointmentStatusType;
      const value = Number(row.count) || 0;
      counts[status] = value;
      counts.all += value;
    }

    return counts;
  }

  async findByStaffIdAndDateRange(
    staffId: string,
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
    storeId: string,
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

  async findPendingReminders(
    storeId: string,
    windowStart: Date,
    windowEnd: Date,
    type: '24h' | '1h',
  ): Promise<Appointment[]> {
    const pendingFlag =
      type === '24h'
        ? eq(schema.appointments.reminder24hSent, false)
        : eq(schema.appointments.reminder1hSent, false);

    return await this.db
      .select()
      .from(schema.appointments)
      .where(
        and(
          eq(schema.appointments.storeId, storeId),
          gte(schema.appointments.startDateTime, windowStart),
          lt(schema.appointments.startDateTime, windowEnd),
          or(
            eq(schema.appointments.status, 'pending'),
            eq(schema.appointments.status, 'confirmed'),
          ),
          pendingFlag,
        ),
      )
      .orderBy(schema.appointments.startDateTime);
  }

  async markReminderSent(id: string, type: '24h' | '1h') {
    const field =
      type === '24h'
        ? { reminder24hSent: true, updatedAt: new Date() }
        : { reminder1hSent: true, updatedAt: new Date() };

    const [updated] = await this.db
      .update(schema.appointments)
      .set(field)
      .where(eq(schema.appointments.id, id))
      .returning();

    return updated;
  }

  async claimReminder(id: string, type: '24h' | '1h') {
    const conditions = [eq(schema.appointments.id, id)];

    if (type === '24h') {
      conditions.push(eq(schema.appointments.reminder24hSent, false));
    } else {
      conditions.push(eq(schema.appointments.reminder1hSent, false));
    }

    const [updated] = await this.db
      .update(schema.appointments)
      .set(
        type === '24h'
          ? { reminder24hSent: true, updatedAt: new Date() }
          : { reminder1hSent: true, updatedAt: new Date() },
      )
      .where(and(...conditions))
      .returning({ id: schema.appointments.id });

    return Boolean(updated);
  }

  async resetReminderFlag(id: string, type: '24h' | '1h') {
    const [updated] = await this.db
      .update(schema.appointments)
      .set(
        type === '24h'
          ? { reminder24hSent: false, updatedAt: new Date() }
          : { reminder1hSent: false, updatedAt: new Date() },
      )
      .where(eq(schema.appointments.id, id))
      .returning({ id: schema.appointments.id });

    return Boolean(updated);
  }

  async findOverlappingAppointments(
    staffId: string,
    startDateTime: Date,
    endDateTime: Date,
    excludeAppointmentId?: string,
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

  async update(id: string, data: Partial<Appointment>): Promise<Appointment> {
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

  async markExpiredAppointments(now: Date): Promise<number> {
    const expireStatuses: AppointmentStatusType[] = ['pending'];

    const result = await this.db
      .update(schema.appointments)
      .set({ status: 'expired', updatedAt: now })
      .where(
        and(
          lt(schema.appointments.endDateTime, now),
          inArray(schema.appointments.status, expireStatuses),
        ),
      )
      .returning({ id: schema.appointments.id });

    return result.length;
  }

  async purgeOldNonPendingAppointments(
    now: Date,
    defaultRetentionMonths = 1,
    businessRetentionMonths = 6,
  ): Promise<{
    deletedStandard: number;
    deletedBusiness: number;
    total: number;
  }> {
    const defaultThreshold = new Date(now);
    defaultThreshold.setMonth(
      defaultThreshold.getMonth() - defaultRetentionMonths,
    );

    const businessThreshold = new Date(now);
    businessThreshold.setMonth(
      businessThreshold.getMonth() - businessRetentionMonths,
    );

    const standardStoreIds = (
      await this.db
        .select({ id: schema.stores.id })
        .from(schema.stores)
        .innerJoin(schema.users, eq(schema.stores.ownerId, schema.users.id))
        .where(ne(schema.users.paymentStatus, 'business'))
    ).map((row) => row.id);

    const businessStoreIds = (
      await this.db
        .select({ id: schema.stores.id })
        .from(schema.stores)
        .innerJoin(schema.users, eq(schema.stores.ownerId, schema.users.id))
        .where(eq(schema.users.paymentStatus, 'business'))
    ).map((row) => row.id);

    const standardResult =
      standardStoreIds.length > 0
        ? await this.db
            .delete(schema.appointments)
            .where(
              and(
                inArray(schema.appointments.storeId, standardStoreIds),
                ne(schema.appointments.status, 'pending'),
                lt(schema.appointments.endDateTime, defaultThreshold),
              ),
            )
            .returning({ id: schema.appointments.id })
        : [];

    const businessResult =
      businessStoreIds.length > 0
        ? await this.db
            .delete(schema.appointments)
            .where(
              and(
                inArray(schema.appointments.storeId, businessStoreIds),
                ne(schema.appointments.status, 'pending'),
                lt(schema.appointments.endDateTime, businessThreshold),
              ),
            )
            .returning({ id: schema.appointments.id })
        : [];

    return {
      deletedStandard: standardResult.length,
      deletedBusiness: businessResult.length,
      total: standardResult.length + businessResult.length,
    };
  }

  async purgeExpiredAppointments(
    now: Date,
    retentionDays = 7,
  ): Promise<number> {
    const threshold = new Date(now);
    threshold.setDate(threshold.getDate() - retentionDays);

    const result = await this.db
      .delete(schema.appointments)
      .where(
        and(
          eq(schema.appointments.status, 'expired'),
          lt(schema.appointments.endDateTime, threshold),
        ),
      )
      .returning({ id: schema.appointments.id });

    return result.length;
  }

  async delete(id: string): Promise<void> {
    const result = await this.db
      .delete(schema.appointments)
      .where(eq(schema.appointments.id, id))
      .returning();

    if (result.length === 0) {
      throw new NotFoundException(`Appointment with ID ${id} not found`);
    }
  }

  private buildWhereClause(
    storeId: string,
    filters: AppointmentQueryFilters,
    options: { includeStatus?: boolean } = {},
  ): SQL | undefined {
    const conditions = this.buildFilterConditions(storeId, filters, options);
    return this.combineWithAnd(conditions);
  }

  private buildFilterConditions(
    storeId: string,
    filters: AppointmentQueryFilters,
    options: { includeStatus?: boolean } = {},
  ): SQL[] {
    const includeStatus = options.includeStatus ?? true;
    const conditions: SQL[] = [eq(schema.appointments.storeId, storeId)];

    if (includeStatus && filters.status) {
      conditions.push(eq(schema.appointments.status, filters.status));
    }

    if (filters.serviceId) {
      conditions.push(eq(schema.appointments.serviceId, filters.serviceId));
    }

    if (filters.staffIds && filters.staffIds.length > 0) {
      conditions.push(inArray(schema.appointments.staffId, filters.staffIds));
    } else if (filters.staffId) {
      conditions.push(eq(schema.appointments.staffId, filters.staffId));
    }

    if (filters.locationId) {
      conditions.push(eq(schema.appointments.locationId, filters.locationId));
    }

    if (filters.customerId) {
      conditions.push(eq(schema.appointments.customerId, filters.customerId));
    }

    const startDate = this.parseDate(filters.startDate);
    if (startDate) {
      conditions.push(gte(schema.appointments.startDateTime, startDate));
    }

    const endDate = this.parseDate(filters.endDate, { endOfDay: true });
    if (endDate) {
      conditions.push(lte(schema.appointments.startDateTime, endDate));
    }

    const searchCondition = this.buildSearchCondition(filters.search);
    if (searchCondition) {
      conditions.push(searchCondition);
    }

    return conditions;
  }

  private buildSearchCondition(search?: string): SQL | undefined {
    const trimmed = search?.trim();
    const pattern = this.formatSearchPattern(trimmed);
    if (!pattern) {
      return undefined;
    }

    const isNumericSearch = /^[0-9]+$/.test(trimmed ?? '');

    // For purely numeric inputs, treat as an exact publicNumber lookup to avoid
    // partial matches via the broader OR conditions (e.g., "%01%" matching "04").
    if (isNumericSearch) {
      return eq(schema.appointments.publicNumber, trimmed!);
    }

    return sql`
      (
        ${schema.appointments.publicNumber} ILIKE ${pattern}
        OR CAST(${schema.appointments.id} AS TEXT) ILIKE ${pattern}
        OR ${schema.appointments.guestFirstName} ILIKE ${pattern}
        OR ${schema.appointments.guestLastName} ILIKE ${pattern}
        OR ${schema.appointments.guestEmail} ILIKE ${pattern}
        OR ${schema.appointments.guestPhone} ILIKE ${pattern}
        OR ${schema.appointments.customerNotes} ILIKE ${pattern}
        OR ${schema.appointments.internalNotes} ILIKE ${pattern}
        OR EXISTS (
          SELECT 1 FROM users
          WHERE users.id = ${schema.appointments.customerId}
            AND (
              users.first_name ILIKE ${pattern}
              OR users.last_name ILIKE ${pattern}
              OR users.email ILIKE ${pattern}
            )
        )
        OR EXISTS (
          SELECT 1 FROM services
          WHERE services.id = ${schema.appointments.serviceId}
            AND services.name ILIKE ${pattern}
        )
      )
    `;
  }

  async incrementStoreAppointmentCount(storeId: string): Promise<void> {
    await this.db
      .update(schema.stores)
      .set({
        totalAppointments: sql`${schema.stores.totalAppointments} + 1`,
      })
      .where(eq(schema.stores.id, storeId));
  }
}
