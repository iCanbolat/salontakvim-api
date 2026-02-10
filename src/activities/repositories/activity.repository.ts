import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, lt, sql } from 'drizzle-orm';
import { DRIZZLE_ORM } from '../../db/drizzle.module';
import * as schema from '../../db/schema';
import { Activity, NewActivity } from '../interfaces/activity.interface';

@Injectable()
export class ActivityRepository {
  constructor(
    @Inject(DRIZZLE_ORM)
    private readonly db: any,
  ) {}

  async create(data: NewActivity): Promise<Activity> {
    const [activity] = await this.db
      .insert(schema.activities)
      .values(data)
      .returning();

    return activity;
  }

  async findRecentByStoreId(
    storeId: string,
    limit = 20,
    locationId?: string,
  ): Promise<Activity[]> {
    const conditions = [eq(schema.activities.storeId, storeId)];

    if (locationId) {
      conditions.push(
        eq(
          sql<string>`${schema.activities.metadata} ->> 'locationId'`,
          locationId,
        ),
      );
    }

    const where = conditions.length > 1 ? and(...conditions) : conditions[0];

    return this.db
      .select()
      .from(schema.activities)
      .where(where)
      .orderBy(desc(schema.activities.createdAt))
      .limit(limit);
  }

  async findByStoreIdPaginated(
    storeId: string,
    page = 1,
    limit = 20,
    type?: string,
    locationId?: string,
  ) {
    const offset = (page - 1) * limit;
    const conditions = [eq(schema.activities.storeId, storeId)];

    if (type) {
      conditions.push(eq(schema.activities.type, type as any));
    }

    if (locationId) {
      conditions.push(
        eq(
          sql<string>`${schema.activities.metadata} ->> 'locationId'`,
          locationId,
        ),
      );
    }

    const where = conditions.length > 1 ? and(...conditions) : conditions[0];

    const data = await this.db
      .select()
      .from(schema.activities)
      .where(where)
      .orderBy(desc(schema.activities.createdAt))
      .limit(limit)
      .offset(offset);

    const [countResult] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(schema.activities)
      .where(where);

    const total = Number(countResult?.count ?? 0);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  }

  async deleteOlderThan(cutoff: Date) {
    const deleted = await this.db
      .delete(schema.activities)
      .where(lt(schema.activities.createdAt, cutoff))
      .returning({ id: schema.activities.id });

    return deleted.length;
  }
}
