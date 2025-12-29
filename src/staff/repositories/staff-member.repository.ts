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

  async findByStoreId(storeId: string): Promise<StaffMember[]> {
    return await this.db
      .select()
      .from(schema.staffMembers)
      .where(eq(schema.staffMembers.storeId, storeId));
  }

  async findByIdAndStoreId(
    id: string,
    storeId: string,
  ): Promise<StaffMember | null> {
    const [staffMember] = await this.db
      .select()
      .from(schema.staffMembers)
      .where(
        and(
          eq(schema.staffMembers.id, id),
          eq(schema.staffMembers.storeId, storeId),
        ),
      )
      .limit(1);
    return staffMember || null;
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
