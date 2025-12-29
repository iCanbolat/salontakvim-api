import { Injectable, Inject } from '@nestjs/common';
import { DRIZZLE_ORM } from '../../db/drizzle.module';
import { users } from '../../db/schema';
import { eq, and, inArray } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { IUserRepository } from '../interfaces/repository.interface';

@Injectable()
export class UserRepository implements IUserRepository {
  constructor(
    @Inject(DRIZZLE_ORM)
    private db: PostgresJsDatabase<typeof import('../../db/schema')>,
  ) {}

  async findById(id: string) {
    const result = await this.db.select().from(users).where(eq(users.id, id));
    return result[0];
  }

  async findByEmail(email: string) {
    const result = await this.db
      .select()
      .from(users)
      .where(eq(users.email, email));
    return result[0];
  }

  async findByProviderId(providerId: string, provider: string) {
    const result = await this.db
      .select()
      .from(users)
      .where(
        and(
          eq(users.providerId, providerId),
          eq(users.authProvider, provider as any),
        ),
      );
    return result[0];
  }

  async create(userData: {
    email: string;
    firstName?: string;
    lastName?: string;
    phone?: string;
    password?: string;
    role?: 'admin' | 'staff' | 'customer';
    paymentStatus?: 'freemium' | 'paid';
    authProvider?: 'local' | 'google' | 'facebook' | 'apple';
    providerId?: string;
    avatar?: string;
    emailVerified?: boolean;
  }) {
    const result = await this.db
      .insert(users)
      .values({
        ...userData,
        role: userData.role || 'admin',
        paymentStatus: userData.paymentStatus || 'freemium',
        authProvider: userData.authProvider || 'local',
        emailVerified: userData.emailVerified || false,
      })
      .returning();
    return result[0];
  }

  async update(
    id: string,
    userData: {
      firstName?: string;
      lastName?: string;
      phone?: string;
      password?: string;
      avatar?: string;
      emailVerified?: boolean;
      isActive?: boolean;
    },
  ) {
    const result = await this.db
      .update(users)
      .set({ ...userData, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return result[0];
  }

  async updateLastLogin(id: string) {
    await this.db
      .update(users)
      .set({ lastLogin: new Date() })
      .where(eq(users.id, id));
  }

  async findByIds(ids: string[]) {
    if (!ids.length) {
      return [];
    }
    return await this.db
      .select()
      .from(users)
      .where(inArray(users.id, Array.from(new Set(ids))));
  }
}
