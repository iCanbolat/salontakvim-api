import { Injectable, Inject } from '@nestjs/common';
import { DRIZZLE_ORM } from '../../db/drizzle.module';
import { refreshTokens } from '../../db/schema';
import { eq } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { IRefreshTokenRepository } from '../interfaces/repository.interface';

@Injectable()
export class RefreshTokenRepository implements IRefreshTokenRepository {
  constructor(
    @Inject(DRIZZLE_ORM)
    private db: PostgresJsDatabase<typeof import('../../db/schema')>,
  ) {}

  async create(userId: string, token: string, expiresAt: Date) {
    const result = await this.db
      .insert(refreshTokens)
      .values({
        userId,
        token,
        expiresAt,
      })
      .returning();
    return result[0];
  }

  async findByToken(token: string) {
    const result = await this.db
      .select()
      .from(refreshTokens)
      .where(eq(refreshTokens.token, token));
    return result[0];
  }

  async deleteByToken(token: string) {
    await this.db.delete(refreshTokens).where(eq(refreshTokens.token, token));
  }

  async deleteAllByUserId(userId: string) {
    await this.db.delete(refreshTokens).where(eq(refreshTokens.userId, userId));
  }
}
