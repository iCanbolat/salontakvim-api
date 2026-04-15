import {
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { and, desc, eq, sql } from 'drizzle-orm';
import { DRIZZLE_ORM } from '../../db/drizzle.module';
import * as schema from '../../db/schema';

export type StorePayout = typeof schema.storePayouts.$inferSelect;
export type StorePayoutStatus = 'pending' | 'paid';

@Injectable()
export class StorePayoutRepository {
  constructor(
    @Inject(DRIZZLE_ORM)
    private readonly db: any,
  ) {}

  async findByTransactionId(
    transactionId: string,
  ): Promise<StorePayout | null> {
    const [row] = await this.db
      .select()
      .from(schema.storePayouts)
      .where(eq(schema.storePayouts.transactionId, transactionId))
      .limit(1);

    return row || null;
  }

  async findById(id: string): Promise<StorePayout | null> {
    const [row] = await this.db
      .select()
      .from(schema.storePayouts)
      .where(eq(schema.storePayouts.id, id))
      .limit(1);

    return row || null;
  }

  async createPending(params: {
    storeId: string;
    transactionId: string;
    grossAmount: number;
    platformFee: number;
    netAmount: number;
    currency: string;
    metadata?: Record<string, unknown>;
  }): Promise<StorePayout> {
    const existing = await this.findByTransactionId(params.transactionId);
    if (existing) {
      return existing;
    }

    const [row] = await this.db
      .insert(schema.storePayouts)
      .values({
        storeId: params.storeId,
        transactionId: params.transactionId,
        grossAmount: params.grossAmount.toFixed(2),
        platformFee: params.platformFee.toFixed(2),
        netAmount: params.netAmount.toFixed(2),
        currency: params.currency.toUpperCase(),
        status: 'pending',
        metadata: params.metadata || null,
      })
      .onConflictDoNothing({
        target: schema.storePayouts.transactionId,
      })
      .returning();

    if (row) {
      return row;
    }

    const createdByConcurrentRequest = await this.findByTransactionId(
      params.transactionId,
    );

    if (createdByConcurrentRequest) {
      return createdByConcurrentRequest;
    }

    throw new InternalServerErrorException(
      'Failed to create payout ledger entry',
    );
  }

  async findByStoreId(
    storeId: string,
    options?: { status?: StorePayoutStatus; page?: number; limit?: number },
  ): Promise<{
    data: StorePayout[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const page = Math.max(options?.page || 1, 1);
    const limit = Math.min(Math.max(options?.limit || 10, 1), 100);
    const offset = (page - 1) * limit;

    const conditions = [eq(schema.storePayouts.storeId, storeId)];
    if (options?.status) {
      conditions.push(eq(schema.storePayouts.status, options.status));
    }

    const whereClause =
      conditions.length > 1 ? and(...conditions) : conditions[0];

    const [countRow] = await this.db
      .select({
        count: sql<number>`COUNT(*)`,
      })
      .from(schema.storePayouts)
      .where(whereClause);

    const total = Number(countRow?.count || 0);

    const data = await this.db
      .select()
      .from(schema.storePayouts)
      .where(whereClause)
      .orderBy(desc(schema.storePayouts.createdAt))
      .limit(limit)
      .offset(offset);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit) || 1),
    };
  }

  async getStoreSummary(storeId: string): Promise<{
    pendingCount: number;
    paidCount: number;
    pendingNetAmount: string;
    paidNetAmount: string;
    currency: string | null;
  }> {
    const [row] = await this.db
      .select({
        pendingCount: sql<number>`COALESCE(SUM(CASE WHEN ${schema.storePayouts.status} = 'pending' THEN 1 ELSE 0 END), 0)`,
        paidCount: sql<number>`COALESCE(SUM(CASE WHEN ${schema.storePayouts.status} = 'paid' THEN 1 ELSE 0 END), 0)`,
        pendingNetAmount: sql<string>`COALESCE(SUM(CASE WHEN ${schema.storePayouts.status} = 'pending' THEN ${schema.storePayouts.netAmount}::numeric ELSE 0 END), 0)::text`,
        paidNetAmount: sql<string>`COALESCE(SUM(CASE WHEN ${schema.storePayouts.status} = 'paid' THEN ${schema.storePayouts.netAmount}::numeric ELSE 0 END), 0)::text`,
        currency: sql<string | null>`MAX(${schema.storePayouts.currency})`,
      })
      .from(schema.storePayouts)
      .where(eq(schema.storePayouts.storeId, storeId));

    return {
      pendingCount: Number(row?.pendingCount || 0),
      paidCount: Number(row?.paidCount || 0),
      pendingNetAmount: row?.pendingNetAmount || '0',
      paidNetAmount: row?.paidNetAmount || '0',
      currency: row?.currency || null,
    };
  }

  async markAsPaid(id: string, paidAt = new Date()): Promise<StorePayout> {
    const [updated] = await this.db
      .update(schema.storePayouts)
      .set({
        status: 'paid',
        paidAt,
      })
      .where(
        and(
          eq(schema.storePayouts.id, id),
          eq(schema.storePayouts.status, 'pending'),
        ),
      )
      .returning();

    if (updated) {
      return updated;
    }

    const existing = await this.findById(id);
    if (existing) {
      return existing;
    }

    throw new NotFoundException('Store payout not found');
  }
}
