import { Inject, Injectable } from '@nestjs/common';
import { desc, eq } from 'drizzle-orm';
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

  async findRecentByStoreId(storeId: string, limit = 20): Promise<Activity[]> {
    return this.db
      .select()
      .from(schema.activities)
      .where(eq(schema.activities.storeId, storeId))
      .orderBy(desc(schema.activities.createdAt))
      .limit(limit);
  }
}
