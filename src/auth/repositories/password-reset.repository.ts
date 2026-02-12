import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, lt } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { DRIZZLE_ORM } from '../../db/drizzle.module';
import * as schema from '../../db/schema';

@Injectable()
export class PasswordResetRepository {
  constructor(
    @Inject(DRIZZLE_ORM)
    private readonly db: PostgresJsDatabase<typeof schema>,
  ) {}

  async create(data: { userId: string; tokenHash: string; expiresAt: Date }) {
    const [record] = await this.db
      .insert(schema.passwordResetTokens)
      .values({
        userId: data.userId,
        tokenHash: data.tokenHash,
        expiresAt: data.expiresAt,
      })
      .returning();

    return record;
  }

  async findByTokenHash(tokenHash: string) {
    const [record] = await this.db
      .select()
      .from(schema.passwordResetTokens)
      .where(eq(schema.passwordResetTokens.tokenHash, tokenHash));
    return record;
  }

  async findLatestByUserId(userId: string) {
    const [record] = await this.db
      .select()
      .from(schema.passwordResetTokens)
      .where(eq(schema.passwordResetTokens.userId, userId))
      .orderBy(desc(schema.passwordResetTokens.createdAt))
      .limit(1);
    return record;
  }

  async markUsed(id: string) {
    const [record] = await this.db
      .update(schema.passwordResetTokens)
      .set({ usedAt: new Date() })
      .where(eq(schema.passwordResetTokens.id, id))
      .returning();
    return record;
  }

  async deleteByUserId(userId: string) {
    await this.db
      .delete(schema.passwordResetTokens)
      .where(eq(schema.passwordResetTokens.userId, userId));
  }

  async deleteExpired(now: Date) {
    await this.db
      .delete(schema.passwordResetTokens)
      .where(lt(schema.passwordResetTokens.expiresAt, now));
  }

  async deleteUsedOrExpired(userId: string, now: Date) {
    await this.db
      .delete(schema.passwordResetTokens)
      .where(
        and(
          eq(schema.passwordResetTokens.userId, userId),
          lt(schema.passwordResetTokens.expiresAt, now),
        ),
      );
  }
}
