import { Inject, Injectable } from '@nestjs/common';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { DRIZZLE_ORM } from '../../db/drizzle.module';
import * as schema from '../../db/schema';
import { eq, and, gte, lte, count, sum, sql, desc, asc } from 'drizzle-orm';
import {
  DateRange,
  AppointmentStatusCount,
  AppointmentByDate,
  AppointmentByTimeSlot,
  AppointmentByService,
  AppointmentByStaff,
  RevenueByDate,
  RevenueByService,
  RevenueByStaff,
  RevenueByPaymentMethod,
  CustomerGrowth,
  TopCustomer,
  CustomerBySource,
  StaffPerformance,
  StaffAvailability,
  ServicePopularity,
  ServiceByTime,
  ServiceCategoryPerformance,
  ServiceExtrasAnalytics,
} from '../interfaces/repository.interface';

@Injectable()
export class AnalyticsRepository {
  constructor(
    @Inject(DRIZZLE_ORM)
    private readonly db: PostgresJsDatabase<typeof schema>,
  ) {}

  // ==================== DASHBOARD ====================

  async getTotalAppointments(
    storeId: number,
    dateRange?: DateRange,
  ): Promise<number> {
    const conditions = [eq(schema.appointments.storeId, storeId)];

    if (dateRange) {
      conditions.push(
        gte(schema.appointments.startDateTime, dateRange.startDate),
        lte(schema.appointments.startDateTime, dateRange.endDate),
      );
    }

    const result = await this.db
      .select({ count: count() })
      .from(schema.appointments)
      .where(and(...conditions));

    return result[0]?.count || 0;
  }

  async getTotalRevenue(
    storeId: number,
    dateRange?: DateRange,
  ): Promise<string> {
    const conditions = [
      eq(schema.appointments.storeId, storeId),
      eq(schema.appointments.isPaid, true),
    ];

    if (dateRange) {
      conditions.push(
        gte(schema.appointments.startDateTime, dateRange.startDate),
        lte(schema.appointments.startDateTime, dateRange.endDate),
      );
    }

    const result = await this.db
      .select({ total: sum(schema.appointments.totalPrice) })
      .from(schema.appointments)
      .where(and(...conditions));

    return result[0]?.total || '0';
  }

  async getTotalCustomers(storeId: number): Promise<number> {
    const result = await this.db
      .select({ count: count() })
      .from(schema.appointments)
      .where(eq(schema.appointments.storeId, storeId))
      .groupBy(schema.appointments.customerId);

    return result.length;
  }

  async getAppointmentsByStatus(
    storeId: number,
    dateRange?: DateRange,
  ): Promise<AppointmentStatusCount[]> {
    const conditions = [eq(schema.appointments.storeId, storeId)];

    if (dateRange) {
      conditions.push(
        gte(schema.appointments.startDateTime, dateRange.startDate),
        lte(schema.appointments.startDateTime, dateRange.endDate),
      );
    }

    const result = await this.db
      .select({
        status: schema.appointments.status,
        count: count(),
      })
      .from(schema.appointments)
      .where(and(...conditions))
      .groupBy(schema.appointments.status);

    return result.map((row) => ({
      status: row.status,
      count: Number(row.count),
    }));
  }

  async getPopularTimeSlot(
    storeId: number,
    dateRange?: DateRange,
  ): Promise<string> {
    const conditions = [eq(schema.appointments.storeId, storeId)];

    if (dateRange) {
      conditions.push(
        gte(schema.appointments.startDateTime, dateRange.startDate),
        lte(schema.appointments.startDateTime, dateRange.endDate),
      );
    }

    const hourColumn =
      sql<number>`EXTRACT(HOUR FROM ${schema.appointments.startDateTime})`.as(
        'hour',
      );

    const result = await this.db
      .select({
        hour: hourColumn,
        count: count(),
      })
      .from(schema.appointments)
      .where(and(...conditions))
      .groupBy(hourColumn)
      .orderBy(desc(count()))
      .limit(1);

    if (result.length === 0) return 'N/A';

    const hour = Number(result[0].hour) || 0;
    const endHour = hour + 1;
    return `${hour}:00 - ${endHour}:00`;
  }

  // ==================== APPOINTMENTS ANALYTICS ====================

  async getAppointmentsByDate(
    storeId: number,
    dateRange: DateRange,
    groupBy: 'day' | 'week' | 'month' = 'day',
  ): Promise<AppointmentByDate[]> {
    let dateFormat: string;
    switch (groupBy) {
      case 'week':
        dateFormat = 'YYYY-"W"IW';
        break;
      case 'month':
        dateFormat = 'YYYY-MM';
        break;
      default:
        dateFormat = 'YYYY-MM-DD';
    }

    const dateColumn =
      sql<string>`TO_CHAR(${schema.appointments.startDateTime}, ${dateFormat})`.as(
        'date_group',
      );

    const result = await this.db
      .select({
        date: dateColumn,
        count: count(),
        revenue: sum(schema.appointments.totalPrice),
      })
      .from(schema.appointments)
      .where(
        and(
          eq(schema.appointments.storeId, storeId),
          gte(schema.appointments.startDateTime, dateRange.startDate),
          lte(schema.appointments.startDateTime, dateRange.endDate),
        ),
      )
      .groupBy(dateColumn)
      .orderBy(asc(dateColumn));

    return result.map((row) => ({
      date: row.date,
      count: Number(row.count),
      revenue: row.revenue || '0',
    }));
  }

  async getAppointmentsByTimeSlot(
    storeId: number,
    dateRange: DateRange,
  ): Promise<AppointmentByTimeSlot[]> {
    const hourColumn =
      sql<number>`EXTRACT(HOUR FROM ${schema.appointments.startDateTime})`.as(
        'hour',
      );

    const result = await this.db
      .select({
        hour: hourColumn,
        count: count(),
      })
      .from(schema.appointments)
      .where(
        and(
          eq(schema.appointments.storeId, storeId),
          gte(schema.appointments.startDateTime, dateRange.startDate),
          lte(schema.appointments.startDateTime, dateRange.endDate),
        ),
      )
      .groupBy(hourColumn)
      .orderBy(asc(hourColumn));

    return result.map((row) => ({
      timeSlot: `${Number(row.hour) || 0}:00 - ${(Number(row.hour) || 0) + 1}:00`,
      count: Number(row.count),
    }));
  }

  async getAppointmentsByService(
    storeId: number,
    dateRange: DateRange,
  ): Promise<AppointmentByService[]> {
    const result = await this.db
      .select({
        serviceId: schema.services.id,
        serviceName: schema.services.name,
        count: count(),
        revenue: sum(schema.appointments.totalPrice),
      })
      .from(schema.appointments)
      .innerJoin(
        schema.services,
        eq(schema.appointments.serviceId, schema.services.id),
      )
      .where(
        and(
          eq(schema.appointments.storeId, storeId),
          gte(schema.appointments.startDateTime, dateRange.startDate),
          lte(schema.appointments.startDateTime, dateRange.endDate),
        ),
      )
      .groupBy(schema.services.id, schema.services.name)
      .orderBy(desc(count()));

    return result.map((row) => ({
      serviceId: row.serviceId,
      serviceName: row.serviceName,
      count: Number(row.count),
      revenue: row.revenue || '0',
    }));
  }

  async getAppointmentsByStaff(
    storeId: number,
    dateRange: DateRange,
  ): Promise<AppointmentByStaff[]> {
    const result = await this.db
      .select({
        staffId: schema.staffMembers.id,
        staffName: sql<string>`${schema.users.firstName} || ' ' || ${schema.users.lastName}`,
        count: count(),
        revenue: sum(schema.appointments.totalPrice),
      })
      .from(schema.appointments)
      .innerJoin(
        schema.staffMembers,
        eq(schema.appointments.staffId, schema.staffMembers.id),
      )
      .innerJoin(schema.users, eq(schema.staffMembers.userId, schema.users.id))
      .where(
        and(
          eq(schema.appointments.storeId, storeId),
          gte(schema.appointments.startDateTime, dateRange.startDate),
          lte(schema.appointments.startDateTime, dateRange.endDate),
        ),
      )
      .groupBy(
        schema.staffMembers.id,
        schema.users.firstName,
        schema.users.lastName,
      )
      .orderBy(desc(count()));

    return result.map((row) => ({
      staffId: row.staffId,
      staffName: row.staffName,
      count: Number(row.count),
      revenue: row.revenue || '0',
    }));
  }

  // ==================== REVENUE ANALYTICS ====================

  async getRevenueByDate(
    storeId: number,
    dateRange: DateRange,
    groupBy: 'day' | 'week' | 'month' = 'day',
  ): Promise<RevenueByDate[]> {
    let dateFormat: string;
    switch (groupBy) {
      case 'week':
        dateFormat = 'YYYY-"W"IW';
        break;
      case 'month':
        dateFormat = 'YYYY-MM';
        break;
      default:
        dateFormat = 'YYYY-MM-DD';
    }

    const dateColumn =
      sql<string>`TO_CHAR(${schema.appointments.startDateTime}, ${dateFormat})`.as(
        'date_group',
      );

    const result = await this.db
      .select({
        date: dateColumn,
        revenue: sum(schema.appointments.totalPrice),
        appointmentCount: count(),
      })
      .from(schema.appointments)
      .where(
        and(
          eq(schema.appointments.storeId, storeId),
          eq(schema.appointments.isPaid, true),
          gte(schema.appointments.startDateTime, dateRange.startDate),
          lte(schema.appointments.startDateTime, dateRange.endDate),
        ),
      )
      .groupBy(dateColumn)
      .orderBy(asc(dateColumn));

    return result.map((row) => ({
      date: row.date,
      revenue: row.revenue || '0',
      appointmentCount: Number(row.appointmentCount),
    }));
  }

  async getRevenueByService(
    storeId: number,
    dateRange: DateRange,
  ): Promise<RevenueByService[]> {
    const result = await this.db
      .select({
        serviceId: schema.services.id,
        serviceName: schema.services.name,
        revenue: sum(schema.appointments.totalPrice),
        appointmentCount: count(),
      })
      .from(schema.appointments)
      .innerJoin(
        schema.services,
        eq(schema.appointments.serviceId, schema.services.id),
      )
      .where(
        and(
          eq(schema.appointments.storeId, storeId),
          eq(schema.appointments.isPaid, true),
          gte(schema.appointments.startDateTime, dateRange.startDate),
          lte(schema.appointments.startDateTime, dateRange.endDate),
        ),
      )
      .groupBy(schema.services.id, schema.services.name)
      .orderBy(desc(sum(schema.appointments.totalPrice)));

    return result.map((row) => ({
      serviceId: row.serviceId,
      serviceName: row.serviceName,
      revenue: row.revenue || '0',
      appointmentCount: Number(row.appointmentCount),
    }));
  }

  async getRevenueByStaff(
    storeId: number,
    dateRange: DateRange,
  ): Promise<RevenueByStaff[]> {
    const result = await this.db
      .select({
        staffId: schema.staffMembers.id,
        staffName: sql<string>`${schema.users.firstName} || ' ' || ${schema.users.lastName}`,
        revenue: sum(schema.appointments.totalPrice),
        appointmentCount: count(),
      })
      .from(schema.appointments)
      .innerJoin(
        schema.staffMembers,
        eq(schema.appointments.staffId, schema.staffMembers.id),
      )
      .innerJoin(schema.users, eq(schema.staffMembers.userId, schema.users.id))
      .where(
        and(
          eq(schema.appointments.storeId, storeId),
          eq(schema.appointments.isPaid, true),
          gte(schema.appointments.startDateTime, dateRange.startDate),
          lte(schema.appointments.startDateTime, dateRange.endDate),
        ),
      )
      .groupBy(
        schema.staffMembers.id,
        schema.users.firstName,
        schema.users.lastName,
      )
      .orderBy(desc(sum(schema.appointments.totalPrice)));

    return result.map((row) => ({
      staffId: row.staffId,
      staffName: row.staffName,
      revenue: row.revenue || '0',
      appointmentCount: Number(row.appointmentCount),
    }));
  }

  async getRevenueByPaymentMethod(
    storeId: number,
    dateRange: DateRange,
  ): Promise<RevenueByPaymentMethod[]> {
    const result = await this.db
      .select({
        paymentMethod: schema.appointments.paymentMethod,
        revenue: sum(schema.appointments.totalPrice),
        appointmentCount: count(),
      })
      .from(schema.appointments)
      .where(
        and(
          eq(schema.appointments.storeId, storeId),
          eq(schema.appointments.isPaid, true),
          gte(schema.appointments.startDateTime, dateRange.startDate),
          lte(schema.appointments.startDateTime, dateRange.endDate),
        ),
      )
      .groupBy(schema.appointments.paymentMethod)
      .orderBy(desc(sum(schema.appointments.totalPrice)));

    return result.map((row) => ({
      paymentMethod: row.paymentMethod || 'Unknown',
      revenue: row.revenue || '0',
      appointmentCount: Number(row.appointmentCount),
    }));
  }

  async getPaidUnpaidCounts(
    storeId: number,
    dateRange: DateRange,
  ): Promise<{ paid: number; unpaid: number }> {
    const result = await this.db
      .select({
        isPaid: schema.appointments.isPaid,
        count: count(),
      })
      .from(schema.appointments)
      .where(
        and(
          eq(schema.appointments.storeId, storeId),
          gte(schema.appointments.startDateTime, dateRange.startDate),
          lte(schema.appointments.startDateTime, dateRange.endDate),
        ),
      )
      .groupBy(schema.appointments.isPaid);

    const paid = result.find((r) => r.isPaid === true)?.count || 0;
    const unpaid = result.find((r) => r.isPaid === false)?.count || 0;

    return { paid: Number(paid), unpaid: Number(unpaid) };
  }

  // ==================== CUSTOMER ANALYTICS ====================

  async getCustomerGrowth(
    storeId: number,
    dateRange: DateRange,
    groupBy: 'day' | 'week' | 'month' = 'day',
  ): Promise<CustomerGrowth[]> {
    let dateFormat: string;
    switch (groupBy) {
      case 'week':
        dateFormat = 'YYYY-"W"IW';
        break;
      case 'month':
        dateFormat = 'YYYY-MM';
        break;
      default:
        dateFormat = 'YYYY-MM-DD';
    }

    const result = await this.db
      .select({
        date: sql<string>`TO_CHAR(${schema.users.createdAt}, ${dateFormat})`,
        newCustomers: count(),
      })
      .from(schema.users)
      .innerJoin(
        schema.appointments,
        eq(schema.users.id, schema.appointments.customerId),
      )
      .where(
        and(
          eq(schema.appointments.storeId, storeId),
          eq(schema.users.role, 'customer'),
          gte(schema.users.createdAt, dateRange.startDate),
          lte(schema.users.createdAt, dateRange.endDate),
        ),
      )
      .groupBy(sql`TO_CHAR(${schema.users.createdAt}, ${dateFormat})`)
      .orderBy(asc(sql`TO_CHAR(${schema.users.createdAt}, ${dateFormat})`));

    // Calculate cumulative total
    let runningTotal = 0;
    return result.map((row) => {
      runningTotal += Number(row.newCustomers);
      return {
        date: row.date,
        newCustomers: Number(row.newCustomers),
        totalCustomers: runningTotal,
      };
    });
  }

  async getTopCustomers(
    storeId: number,
    dateRange: DateRange,
    limit: number = 10,
  ): Promise<TopCustomer[]> {
    const result = await this.db
      .select({
        customerId: schema.users.id,
        customerName: sql<string>`${schema.users.firstName} || ' ' || ${schema.users.lastName}`,
        customerEmail: schema.users.email,
        appointmentCount: count(),
        totalSpent: sum(schema.appointments.totalPrice),
        lastAppointmentDate: sql<Date>`MAX(${schema.appointments.startDateTime})`,
      })
      .from(schema.appointments)
      .innerJoin(
        schema.users,
        eq(schema.appointments.customerId, schema.users.id),
      )
      .where(
        and(
          eq(schema.appointments.storeId, storeId),
          gte(schema.appointments.startDateTime, dateRange.startDate),
          lte(schema.appointments.startDateTime, dateRange.endDate),
        ),
      )
      .groupBy(
        schema.users.id,
        schema.users.firstName,
        schema.users.lastName,
        schema.users.email,
      )
      .orderBy(desc(count()))
      .limit(limit);

    return result.map((row) => ({
      customerId: row.customerId,
      customerName: row.customerName,
      customerEmail: row.customerEmail,
      appointmentCount: Number(row.appointmentCount),
      totalSpent: row.totalSpent || '0',
      lastAppointmentDate: row.lastAppointmentDate,
    }));
  }

  async getCustomerRetention(
    storeId: number,
    dateRange: DateRange,
  ): Promise<{ newCustomers: number; returningCustomers: number }> {
    // Get all customers who had appointments in the period
    const allCustomers = await this.db
      .selectDistinct({ customerId: schema.appointments.customerId })
      .from(schema.appointments)
      .where(
        and(
          eq(schema.appointments.storeId, storeId),
          gte(schema.appointments.startDateTime, dateRange.startDate),
          lte(schema.appointments.startDateTime, dateRange.endDate),
        ),
      );

    // Get customers whose first appointment was in this period
    const newCustomers = await this.db
      .select({
        customerId: schema.appointments.customerId,
        firstAppointment: sql<Date>`MIN(${schema.appointments.startDateTime})`,
      })
      .from(schema.appointments)
      .where(eq(schema.appointments.storeId, storeId))
      .groupBy(schema.appointments.customerId)
      .having(
        and(
          gte(
            sql`MIN(${schema.appointments.startDateTime})`,
            dateRange.startDate,
          ),
          lte(
            sql`MIN(${schema.appointments.startDateTime})`,
            dateRange.endDate,
          ),
        ),
      );

    const totalCustomers = allCustomers.length;
    const newCount = newCustomers.length;
    const returningCount = totalCustomers - newCount;

    return {
      newCustomers: newCount,
      returningCustomers: returningCount,
    };
  }

  async getCustomersBySource(storeId: number): Promise<CustomerBySource[]> {
    const result = await this.db
      .select({
        source: schema.users.authProvider,
        count: count(),
      })
      .from(schema.users)
      .innerJoin(
        schema.appointments,
        eq(schema.users.id, schema.appointments.customerId),
      )
      .where(
        and(
          eq(schema.appointments.storeId, storeId),
          eq(schema.users.role, 'customer'),
        ),
      )
      .groupBy(schema.users.authProvider);

    return result.map((row) => ({
      source: row.source,
      count: Number(row.count),
    }));
  }

  // ==================== STAFF ANALYTICS ====================

  async getStaffPerformance(
    storeId: number,
    dateRange: DateRange,
  ): Promise<StaffPerformance[]> {
    const result = await this.db
      .select({
        staffId: schema.staffMembers.id,
        staffName: sql<string>`${schema.users.firstName} || ' ' || ${schema.users.lastName}`,
        totalAppointments: count(),
        completedAppointments: sql<number>`COUNT(CASE WHEN ${schema.appointments.status} = 'completed' THEN 1 END)`,
        cancelledAppointments: sql<number>`COUNT(CASE WHEN ${schema.appointments.status} = 'cancelled' THEN 1 END)`,
        noShowAppointments: sql<number>`COUNT(CASE WHEN ${schema.appointments.status} = 'no_show' THEN 1 END)`,
        totalRevenue: sum(schema.appointments.totalPrice),
      })
      .from(schema.appointments)
      .innerJoin(
        schema.staffMembers,
        eq(schema.appointments.staffId, schema.staffMembers.id),
      )
      .innerJoin(schema.users, eq(schema.staffMembers.userId, schema.users.id))
      .where(
        and(
          eq(schema.appointments.storeId, storeId),
          gte(schema.appointments.startDateTime, dateRange.startDate),
          lte(schema.appointments.startDateTime, dateRange.endDate),
        ),
      )
      .groupBy(
        schema.staffMembers.id,
        schema.users.firstName,
        schema.users.lastName,
      );

    return result.map((row) => ({
      staffId: row.staffId,
      staffName: row.staffName,
      appointmentCount: Number(row.totalAppointments),
      completedAppointments: Number(row.completedAppointments),
      cancelledAppointments: Number(row.cancelledAppointments),
      noShowAppointments: Number(row.noShowAppointments),
      totalRevenue: row.totalRevenue || '0',
    }));
  }

  async getStaffAvailability(storeId: number): Promise<StaffAvailability[]> {
    // Get all staff working hours
    const workingHours = await this.db
      .select({
        staffId: schema.staffMembers.id,
        staffName: sql<string>`${schema.users.firstName} || ' ' || ${schema.users.lastName}`,
        totalMinutes: sql<number>`SUM(
          EXTRACT(EPOCH FROM (${schema.staffWorkingHours.endTime} - ${schema.staffWorkingHours.startTime})) / 60
        )`,
      })
      .from(schema.staffMembers)
      .innerJoin(schema.users, eq(schema.staffMembers.userId, schema.users.id))
      .leftJoin(
        schema.staffWorkingHours,
        eq(schema.staffMembers.id, schema.staffWorkingHours.staffId),
      )
      .where(eq(schema.staffMembers.storeId, storeId))
      .groupBy(
        schema.staffMembers.id,
        schema.users.firstName,
        schema.users.lastName,
      );

    return workingHours.map((row) => ({
      staffId: row.staffId,
      staffName: row.staffName,
      totalHours: Math.round(((row.totalMinutes || 0) / 60) * 100) / 100,
      bookedHours: 0, // Will be calculated in service layer
    }));
  }

  // ==================== SERVICE ANALYTICS ====================

  async getServicePopularity(
    storeId: number,
    dateRange: DateRange,
    limit?: number,
  ): Promise<ServicePopularity[]> {
    let query = this.db
      .select({
        serviceId: schema.services.id,
        serviceName: schema.services.name,
        categoryName: schema.categories.name,
        appointmentCount: count(),
        revenue: sum(schema.appointments.totalPrice),
        averagePrice: sql<string>`AVG(${schema.appointments.totalPrice})`,
      })
      .from(schema.appointments)
      .innerJoin(
        schema.services,
        eq(schema.appointments.serviceId, schema.services.id),
      )
      .leftJoin(
        schema.categories,
        eq(schema.services.categoryId, schema.categories.id),
      )
      .where(
        and(
          eq(schema.appointments.storeId, storeId),
          gte(schema.appointments.startDateTime, dateRange.startDate),
          lte(schema.appointments.startDateTime, dateRange.endDate),
        ),
      )
      .groupBy(schema.services.id, schema.services.name, schema.categories.name)
      .orderBy(desc(count()));

    if (limit) {
      query = query.limit(limit) as any;
    }

    const result = await query;

    return result.map((row) => ({
      serviceId: row.serviceId,
      serviceName: row.serviceName,
      categoryName: row.categoryName || 'Uncategorized',
      appointmentCount: Number(row.appointmentCount),
      revenue: row.revenue || '0',
      averagePrice: row.averagePrice || '0',
    }));
  }

  async getServiceByTime(
    storeId: number,
    dateRange: DateRange,
    groupBy: 'day' | 'week' | 'month' = 'day',
  ): Promise<ServiceByTime[]> {
    let dateFormat: string;
    switch (groupBy) {
      case 'week':
        dateFormat = 'YYYY-"W"IW';
        break;
      case 'month':
        dateFormat = 'YYYY-MM';
        break;
      default:
        dateFormat = 'YYYY-MM-DD';
    }

    const dateColumn =
      sql<string>`TO_CHAR(${schema.appointments.startDateTime}, ${dateFormat})`.as(
        'date_group',
      );

    const result = await this.db
      .select({
        date: dateColumn,
        serviceId: schema.services.id,
        serviceName: schema.services.name,
        count: count(),
        revenue: sum(schema.appointments.totalPrice),
      })
      .from(schema.appointments)
      .innerJoin(
        schema.services,
        eq(schema.appointments.serviceId, schema.services.id),
      )
      .where(
        and(
          eq(schema.appointments.storeId, storeId),
          gte(schema.appointments.startDateTime, dateRange.startDate),
          lte(schema.appointments.startDateTime, dateRange.endDate),
        ),
      )
      .groupBy(dateColumn, schema.services.id, schema.services.name)
      .orderBy(asc(dateColumn));

    return result.map((row) => ({
      date: row.date,
      serviceId: row.serviceId,
      serviceName: row.serviceName,
      count: Number(row.count),
      revenue: row.revenue || '0',
    }));
  }

  async getServiceCategoryPerformance(
    storeId: number,
    dateRange: DateRange,
  ): Promise<ServiceCategoryPerformance[]> {
    const result = await this.db
      .select({
        categoryId: schema.categories.id,
        categoryName: schema.categories.name,
        serviceCount: sql<number>`COUNT(DISTINCT ${schema.services.id})`,
        appointmentCount: count(),
        revenue: sum(schema.appointments.totalPrice),
      })
      .from(schema.appointments)
      .innerJoin(
        schema.services,
        eq(schema.appointments.serviceId, schema.services.id),
      )
      .innerJoin(
        schema.categories,
        eq(schema.services.categoryId, schema.categories.id),
      )
      .where(
        and(
          eq(schema.appointments.storeId, storeId),
          gte(schema.appointments.startDateTime, dateRange.startDate),
          lte(schema.appointments.startDateTime, dateRange.endDate),
        ),
      )
      .groupBy(schema.categories.id, schema.categories.name)
      .orderBy(desc(sum(schema.appointments.totalPrice)));

    return result.map((row) => ({
      categoryId: row.categoryId,
      categoryName: row.categoryName,
      serviceCount: Number(row.serviceCount),
      appointmentCount: Number(row.appointmentCount),
      revenue: row.revenue || '0',
    }));
  }

  async getServiceExtrasAnalytics(
    storeId: number,
    dateRange: DateRange,
  ): Promise<ServiceExtrasAnalytics[]> {
    const result = await this.db
      .select({
        extraId: schema.serviceExtras.id,
        extraName: schema.serviceExtras.name,
        serviceName: schema.services.name,
        timesAdded: count(),
        revenue: sql<string>`SUM(${schema.appointmentExtras.price} * ${schema.appointmentExtras.quantity})`,
      })
      .from(schema.appointmentExtras)
      .innerJoin(
        schema.appointments,
        eq(schema.appointmentExtras.appointmentId, schema.appointments.id),
      )
      .innerJoin(
        schema.serviceExtras,
        eq(schema.appointmentExtras.extraId, schema.serviceExtras.id),
      )
      .innerJoin(
        schema.services,
        eq(schema.serviceExtras.serviceId, schema.services.id),
      )
      .where(
        and(
          eq(schema.appointments.storeId, storeId),
          gte(schema.appointments.startDateTime, dateRange.startDate),
          lte(schema.appointments.startDateTime, dateRange.endDate),
        ),
      )
      .groupBy(
        schema.serviceExtras.id,
        schema.serviceExtras.name,
        schema.services.name,
      )
      .orderBy(desc(count()));

    // Get total appointments for attach rate calculation
    const totalAppointmentsResult = await this.db
      .select({ count: count() })
      .from(schema.appointments)
      .where(
        and(
          eq(schema.appointments.storeId, storeId),
          gte(schema.appointments.startDateTime, dateRange.startDate),
          lte(schema.appointments.startDateTime, dateRange.endDate),
        ),
      );

    const totalAppointments = Number(totalAppointmentsResult[0]?.count || 0);

    return result.map((row) => ({
      extraId: row.extraId,
      extraName: row.extraName,
      serviceName: row.serviceName,
      timesAdded: Number(row.timesAdded),
      revenue: row.revenue || '0',
      totalAppointments,
    }));
  }
}
