import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { eq, and } from 'drizzle-orm';
import { DRIZZLE_ORM } from '../../db/drizzle.module';
import * as schema from '../../db/schema';
import {
  StaffMember,
  NewStaffMember,
} from '../interfaces/repository.interface';

@Injectable()
export class StaffMemberRepository {
  constructor(
    @Inject(DRIZZLE_ORM)
    private readonly db: any,
  ) {}

  async create(data: NewStaffMember): Promise<StaffMember> {
    const [staffMember] = await this.db
      .insert(schema.staffMembers)
      .values(data)
      .returning();
    return staffMember;
  }

  async findById(id: string): Promise<StaffMember | null> {
    const [staffMember] = await this.db
      .select()
      .from(schema.staffMembers)
      .where(eq(schema.staffMembers.id, id))
      .limit(1);
    return staffMember || null;
  }

  async findByUserId(userId: string): Promise<StaffMember | null> {
    const [staffMember] = await this.db
      .select()
      .from(schema.staffMembers)
      .where(eq(schema.staffMembers.userId, userId))
      .limit(1);
    return staffMember || null;
  }

  async findByStoreId(storeId: string): Promise<
    (StaffMember & {
      firstName?: string | null;
      lastName?: string | null;
    })[]
  > {
    const rows = await this.db
      .select({
        staff: schema.staffMembers,
        user: {
          firstName: schema.users.firstName,
          lastName: schema.users.lastName,
        },
      })
      .from(schema.staffMembers)
      .leftJoin(schema.users, eq(schema.staffMembers.userId, schema.users.id))
      .where(eq(schema.staffMembers.storeId, storeId));

    return rows.map((row) => ({
      ...row.staff,
      firstName: row.user?.firstName ?? null,
      lastName: row.user?.lastName ?? null,
    }));
  }

  async findByIdAndStoreId(id: string, storeId: string): Promise<any | null> {
    const rows = await this.db
      .select({
        staffMember: schema.staffMembers,
        user: {
          firstName: schema.users.firstName,
          lastName: schema.users.lastName,
          email: schema.users.email,
        },
      })
      .from(schema.staffMembers)
      .innerJoin(schema.users, eq(schema.staffMembers.userId, schema.users.id))
      .where(
        and(
          eq(schema.staffMembers.id, id),
          eq(schema.staffMembers.storeId, storeId),
        ),
      )
      .limit(1);

    if (rows.length === 0) return null;

    return {
      ...rows[0].staffMember,
      firstName: rows[0].user.firstName,
      lastName: rows[0].user.lastName,
      email: rows[0].user.email,
    };
  }

  async findByUserIdAndStoreId(
    userId: string,
    storeId: string,
  ): Promise<StaffMember | null> {
    const [staffMember] = await this.db
      .select()
      .from(schema.staffMembers)
      .where(
        and(
          eq(schema.staffMembers.userId, userId),
          eq(schema.staffMembers.storeId, storeId),
        ),
      )
      .limit(1);
    return staffMember || null;
  }

  async findVisibleByStoreId(storeId: string): Promise<StaffMember[]> {
    return await this.db
      .select()
      .from(schema.staffMembers)
      .where(
        and(
          eq(schema.staffMembers.storeId, storeId),
          eq(schema.staffMembers.isVisible, true),
        ),
      );
  }

  async findManagerUserIdsByStoreAndLocation(
    storeId: string,
    locationId: string,
  ): Promise<string[]> {
    const rows = await this.db
      .select({ userId: schema.users.id })
      .from(schema.staffMembers)
      .innerJoin(schema.users, eq(schema.staffMembers.userId, schema.users.id))
      .where(
        and(
          eq(schema.staffMembers.storeId, storeId),
          eq(schema.staffMembers.locationId, locationId),
          eq(schema.users.role, 'manager'),
          eq(schema.users.isActive, true),
        ),
      );

    return rows.map((row) => row.userId);
  }

  async findManagerUserIdsByStore(storeId: string): Promise<string[]> {
    const rows = await this.db
      .select({ userId: schema.users.id })
      .from(schema.staffMembers)
      .innerJoin(schema.users, eq(schema.staffMembers.userId, schema.users.id))
      .where(
        and(
          eq(schema.staffMembers.storeId, storeId),
          eq(schema.users.role, 'manager'),
          eq(schema.users.isActive, true),
        ),
      );

    return rows.map((row) => row.userId);
  }

  async update(id: string, data: Partial<StaffMember>): Promise<StaffMember> {
    const [updatedStaffMember] = await this.db
      .update(schema.staffMembers)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(schema.staffMembers.id, id))
      .returning();

    if (!updatedStaffMember) {
      throw new NotFoundException(`Staff member with ID ${id} not found`);
    }

    return updatedStaffMember;
  }

  async delete(id: string): Promise<void> {
    const result = await this.db
      .delete(schema.staffMembers)
      .where(eq(schema.staffMembers.id, id))
      .returning();

    if (result.length === 0) {
      throw new NotFoundException(`Staff member with ID ${id} not found`);
    }
  }
}
