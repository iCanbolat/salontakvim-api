import { Inject, Injectable } from '@nestjs/common';
import {
  eq,
  and,
  sql,
  desc,
  avg,
  count,
  SQL,
  or,
  ilike,
  aliasedTable,
} from 'drizzle-orm';
import {
  appointmentFeedback,
  appointments,
  users,
  staffMembers,
  services,
} from '../../db/schema';
import { DRIZZLE_ORM } from '../../db/drizzle.module';
import type { CreateFeedbackDto } from '../dto';
import {
  BaseRepository,
  PaginatedResult,
} from '../../common/repositories/base.repository';

export interface FeedbackQueryFilters {
  customerId?: string;
  staffId?: string;
  serviceId?: string;
  search?: string;
  page?: number;
  limit?: number;
}

@Injectable()
export class FeedbackRepository extends BaseRepository<any> {
  constructor(@Inject(DRIZZLE_ORM) db: any) {
    super(db);
  }

  async create(
    storeId: string,
    dto: CreateFeedbackDto,
    appointmentData: {
      customerId?: string | null;
      staffId?: string | null;
      serviceId?: string | null;
    },
  ) {
    const [feedback] = await this.db
      .insert(appointmentFeedback)
      .values({
        appointmentId: dto.appointmentId,
        storeId,
        customerId: appointmentData.customerId,
        staffId: appointmentData.staffId,
        serviceId: appointmentData.serviceId,
        overallRating: dto.overallRating,
        serviceRating: dto.serviceRating,
        staffRating: dto.staffRating,
        cleanlinessRating: dto.cleanlinessRating,
        valueRating: dto.valueRating,
        comment: dto.comment,
        isVerified: true,
      })
      .returning();

    return feedback;
  }

  async findById(id: string, storeId: string) {
    const [feedback] = await this.db
      .select()
      .from(appointmentFeedback)
      .where(
        and(
          eq(appointmentFeedback.id, id),
          eq(appointmentFeedback.storeId, storeId),
        ),
      );

    return feedback;
  }

  async findByAppointmentId(appointmentId: string) {
    const [feedback] = await this.db
      .select()
      .from(appointmentFeedback)
      .where(eq(appointmentFeedback.appointmentId, appointmentId));

    return feedback;
  }

  async findByAppointmentIdWithDetails(appointmentId: string, storeId: string) {
    const staffUsers = aliasedTable(users, 'staff_users');
    const [result] = await this.db
      .select({
        feedback: appointmentFeedback,
        customer: {
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
          avatar: users.avatar,
        },
        staff: {
          id: staffMembers.id,
          firstName: staffUsers.firstName,
          lastName: staffUsers.lastName,
        },
        service: {
          id: services.id,
          name: services.name,
        },
      })
      .from(appointmentFeedback)
      .leftJoin(users, eq(appointmentFeedback.customerId, users.id))
      .leftJoin(staffMembers, eq(appointmentFeedback.staffId, staffMembers.id))
      .leftJoin(staffUsers, eq(staffMembers.userId, staffUsers.id))
      .leftJoin(services, eq(appointmentFeedback.serviceId, services.id))
      .where(
        and(
          eq(appointmentFeedback.appointmentId, appointmentId),
          eq(appointmentFeedback.storeId, storeId),
        ),
      );

    return result;
  }

  async findAll(
    storeId: string,
    options?: {
      customerId?: string;
      staffId?: string;
      serviceId?: string;
      minRating?: number;
      maxRating?: number;
      limit?: number;
      offset?: number;
    },
  ) {
    const conditions = [eq(appointmentFeedback.storeId, storeId)];

    if (options?.customerId) {
      conditions.push(eq(appointmentFeedback.customerId, options.customerId));
    }
    if (options?.staffId) {
      conditions.push(eq(appointmentFeedback.staffId, options.staffId));
    }
    if (options?.serviceId) {
      conditions.push(eq(appointmentFeedback.serviceId, options.serviceId));
    }

    const staffUsers = aliasedTable(users, 'staff_users');
    let query = this.db
      .select({
        feedback: appointmentFeedback,
        customer: {
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
          avatar: users.avatar,
        },
        staff: {
          id: staffMembers.id,
          firstName: staffUsers.firstName,
          lastName: staffUsers.lastName,
        },
        service: {
          id: services.id,
          name: services.name,
        },
      })
      .from(appointmentFeedback)
      .leftJoin(users, eq(appointmentFeedback.customerId, users.id))
      .leftJoin(staffMembers, eq(appointmentFeedback.staffId, staffMembers.id))
      .leftJoin(staffUsers, eq(staffMembers.userId, staffUsers.id))
      .leftJoin(services, eq(appointmentFeedback.serviceId, services.id))
      .where(and(...conditions))
      .orderBy(desc(appointmentFeedback.createdAt))
      .$dynamic();

    if (options?.limit) {
      query = query.limit(options.limit);
    }
    if (options?.offset) {
      query = query.offset(options.offset);
    }

    return query;
  }

  async findAllPaginated(
    storeId: string,
    filters: FeedbackQueryFilters = {},
  ): Promise<
    PaginatedResult<{ feedback: any; customer: any; staff: any; service: any }>
  > {
    const pagination = this.normalizePagination(filters, 10, 100);
    const staffUsers = aliasedTable(users, 'staff_users');
    const whereCondition = this.buildWhereClause(storeId, filters, staffUsers);

    const queryFactory = (limit: number, offset: number) => {
      let query = this.db
        .select({
          feedback: appointmentFeedback,
          customer: {
            id: users.id,
            firstName: users.firstName,
            lastName: users.lastName,
            avatar: users.avatar,
          },
          staff: {
            id: staffMembers.id,
            firstName: staffUsers.firstName,
            lastName: staffUsers.lastName,
          },
          service: {
            id: services.id,
            name: services.name,
          },
        })
        .from(appointmentFeedback)
        .leftJoin(users, eq(appointmentFeedback.customerId, users.id))
        .leftJoin(
          staffMembers,
          eq(appointmentFeedback.staffId, staffMembers.id),
        )
        .leftJoin(staffUsers, eq(staffMembers.userId, staffUsers.id))
        .leftJoin(services, eq(appointmentFeedback.serviceId, services.id))
        .orderBy(desc(appointmentFeedback.createdAt))
        .limit(limit)
        .offset(offset);

      if (whereCondition) {
        query = query.where(whereCondition);
      }

      return query;
    };

    const countFactory = async () => {
      let countQuery = this.db
        .select({ count: count(appointmentFeedback.id) })
        .from(appointmentFeedback)
        .leftJoin(users, eq(appointmentFeedback.customerId, users.id))
        .leftJoin(
          staffMembers,
          eq(appointmentFeedback.staffId, staffMembers.id),
        )
        .leftJoin(staffUsers, eq(staffMembers.userId, staffUsers.id))
        .leftJoin(services, eq(appointmentFeedback.serviceId, services.id));

      if (whereCondition) {
        countQuery = countQuery.where(whereCondition);
      }

      const [result] = await countQuery;
      return result ? Number(result.count) : 0;
    };

    return this.executePaginatedQuery(pagination, queryFactory, countFactory);
  }

  private buildWhereClause(
    storeId: string,
    filters: FeedbackQueryFilters = {},
    staffUsers?: any,
  ): SQL | undefined {
    const conditions: SQL[] = [eq(appointmentFeedback.storeId, storeId)];

    if (filters.customerId) {
      conditions.push(eq(appointmentFeedback.customerId, filters.customerId));
    }

    if (filters.staffId) {
      conditions.push(eq(appointmentFeedback.staffId, filters.staffId));
    }

    if (filters.serviceId) {
      conditions.push(eq(appointmentFeedback.serviceId, filters.serviceId));
    }

    if (filters.search) {
      const searchTerm = `%${filters.search}%`;
      const searchConditions = [
        ilike(appointmentFeedback.comment, searchTerm),
        ilike(users.firstName, searchTerm),
        ilike(users.lastName, searchTerm),
        ilike(services.name, searchTerm),
      ];

      if (staffUsers) {
        searchConditions.push(ilike(staffUsers.firstName, searchTerm));
        searchConditions.push(ilike(staffUsers.lastName, searchTerm));
      }

      conditions.push(or(...searchConditions)!);
    }

    return this.combineWithAnd(conditions);
  }

  async findWithDetails(id: string, storeId: string) {
    const staffUsers = aliasedTable(users, 'staff_users');
    const [result] = await this.db
      .select({
        feedback: appointmentFeedback,
        customer: {
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
          avatar: users.avatar,
        },
        staff: {
          id: staffMembers.id,
          firstName: staffUsers.firstName,
          lastName: staffUsers.lastName,
        },
        service: {
          id: services.id,
          name: services.name,
        },
      })
      .from(appointmentFeedback)
      .leftJoin(users, eq(appointmentFeedback.customerId, users.id))
      .leftJoin(staffMembers, eq(appointmentFeedback.staffId, staffMembers.id))
      .leftJoin(staffUsers, eq(staffMembers.userId, staffUsers.id))
      .leftJoin(services, eq(appointmentFeedback.serviceId, services.id))
      .where(
        and(
          eq(appointmentFeedback.id, id),
          eq(appointmentFeedback.storeId, storeId),
        ),
      );

    return result;
  }

  async update(
    id: string,
    storeId: string,
    data: Partial<typeof appointmentFeedback.$inferInsert>,
  ) {
    const [feedback] = await this.db
      .update(appointmentFeedback)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(appointmentFeedback.id, id),
          eq(appointmentFeedback.storeId, storeId),
        ),
      )
      .returning();

    return feedback;
  }

  async delete(id: string, storeId: string) {
    await this.db
      .delete(appointmentFeedback)
      .where(
        and(
          eq(appointmentFeedback.id, id),
          eq(appointmentFeedback.storeId, storeId),
        ),
      );
  }

  async getStats(storeId: string, staffId?: string, serviceId?: string) {
    const conditions = [eq(appointmentFeedback.storeId, storeId)];

    if (staffId) {
      conditions.push(eq(appointmentFeedback.staffId, staffId));
    }
    if (serviceId) {
      conditions.push(eq(appointmentFeedback.serviceId, serviceId));
    }

    const [stats] = await this.db
      .select({
        totalFeedback: count(appointmentFeedback.id),
        avgOverall: avg(appointmentFeedback.overallRating),
        avgService: avg(appointmentFeedback.serviceRating),
        avgStaff: avg(appointmentFeedback.staffRating),
        avgCleanliness: avg(appointmentFeedback.cleanlinessRating),
        avgValue: avg(appointmentFeedback.valueRating),
      })
      .from(appointmentFeedback)
      .where(and(...conditions));

    // Get rating distribution
    const distribution = await this.db
      .select({
        rating: appointmentFeedback.overallRating,
        count: count(appointmentFeedback.id),
      })
      .from(appointmentFeedback)
      .where(and(...conditions))
      .groupBy(appointmentFeedback.overallRating);

    const ratingDistribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    distribution.forEach((d) => {
      if (d.rating >= 1 && d.rating <= 5) {
        ratingDistribution[d.rating as 1 | 2 | 3 | 4 | 5] = Number(d.count);
      }
    });

    return {
      totalFeedback: Number(stats?.totalFeedback) || 0,
      averageOverallRating: stats?.avgOverall
        ? parseFloat(String(stats.avgOverall))
        : 0,
      averageServiceRating: stats?.avgService
        ? parseFloat(String(stats.avgService))
        : undefined,
      averageStaffRating: stats?.avgStaff
        ? parseFloat(String(stats.avgStaff))
        : undefined,
      averageCleanlinessRating: stats?.avgCleanliness
        ? parseFloat(String(stats.avgCleanliness))
        : undefined,
      averageValueRating: stats?.avgValue
        ? parseFloat(String(stats.avgValue))
        : undefined,
      ratingDistribution,
    };
  }

  async getStaffAverageRating(staffId: string) {
    const [result] = await this.db
      .select({
        avgRating: avg(appointmentFeedback.staffRating),
        count: count(appointmentFeedback.id),
      })
      .from(appointmentFeedback)
      .where(eq(appointmentFeedback.staffId, staffId));

    return {
      averageRating: result?.avgRating
        ? parseFloat(String(result.avgRating))
        : null,
      totalReviews: Number(result?.count) || 0,
    };
  }

  async getServiceAverageRating(serviceId: string) {
    const [result] = await this.db
      .select({
        avgRating: avg(appointmentFeedback.serviceRating),
        count: count(appointmentFeedback.id),
      })
      .from(appointmentFeedback)
      .where(eq(appointmentFeedback.serviceId, serviceId));

    return {
      averageRating: result?.avgRating
        ? parseFloat(String(result.avgRating))
        : null,
      totalReviews: Number(result?.count) || 0,
    };
  }
}
