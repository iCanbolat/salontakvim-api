import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { eq, and, gte, lte } from 'drizzle-orm';
import { DRIZZLE_ORM } from '../../db/drizzle.module';
import * as schema from '../../db/schema';
import { StaffBreak, NewStaffBreak } from '../interfaces/repository.interface';

type StaffBreakStatusEnum =
  (typeof schema.staffBreakStatusEnum.enumValues)[number];

@Injectable()
export class StaffBreakRepository {
  constructor(
    @Inject(DRIZZLE_ORM)
    private readonly db: any,
  ) {}

  async create(data: NewStaffBreak): Promise<StaffBreak> {
    const [staffBreak] = await this.db
      .insert(schema.staffBreaks)
      .values(data)
      .returning();
    return staffBreak;
  }

  async findById(id: number): Promise<StaffBreak | null> {
    const [staffBreak] = await this.db
      .select()
      .from(schema.staffBreaks)
      .where(eq(schema.staffBreaks.id, id))
      .limit(1);
    return staffBreak || null;
  }

  async findByStaffId(staffId: number): Promise<StaffBreak[]> {
    return await this.db
      .select()
      .from(schema.staffBreaks)
      .where(eq(schema.staffBreaks.staffId, staffId));
  }

  async findByStaffIdAndDateRange(
    staffId: number,
    startDate: string,
    endDate: string,
  ): Promise<StaffBreak[]> {
    return await this.db
      .select()
      .from(schema.staffBreaks)
      .where(
        and(
          eq(schema.staffBreaks.staffId, staffId),
          lte(schema.staffBreaks.startDate, endDate),
          gte(schema.staffBreaks.endDate, startDate),
        ),
      );
  }

  async findByIdAndStaffId(
    id: number,
    staffId: number,
  ): Promise<StaffBreak | null> {
    const [staffBreak] = await this.db
      .select()
      .from(schema.staffBreaks)
      .where(
        and(
          eq(schema.staffBreaks.id, id),
          eq(schema.staffBreaks.staffId, staffId),
        ),
      )
      .limit(1);
    return staffBreak || null;
  }

  async update(id: number, data: Partial<StaffBreak>): Promise<StaffBreak> {
    const [updatedStaffBreak] = await this.db
      .update(schema.staffBreaks)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(schema.staffBreaks.id, id))
      .returning();

    if (!updatedStaffBreak) {
      throw new NotFoundException(`Staff break with ID ${id} not found`);
    }

    return updatedStaffBreak;
  }

  async findByStoreIdWithStaff(
    storeId: number,
    status?: StaffBreakStatusEnum,
  ): Promise<any[]> {
    const conditions = [eq(schema.staffMembers.storeId, storeId)];

    if (status) {
      conditions.push(eq(schema.staffBreaks.status, status));
    }

    const whereClause =
      conditions.length === 1 ? conditions[0] : and(...conditions);

    return await this.db
      .select({
        id: schema.staffBreaks.id,
        staffId: schema.staffBreaks.staffId,
        type: schema.staffBreaks.type,
        status: schema.staffBreaks.status,
        startDate: schema.staffBreaks.startDate,
        endDate: schema.staffBreaks.endDate,
        startTime: schema.staffBreaks.startTime,
        endTime: schema.staffBreaks.endTime,
        reason: schema.staffBreaks.reason,
        isRecurring: schema.staffBreaks.isRecurring,
        createdAt: schema.staffBreaks.createdAt,
        updatedAt: schema.staffBreaks.updatedAt,
        staffTitle: schema.staffMembers.title,
        staffFirstName: schema.users.firstName,
        staffLastName: schema.users.lastName,
        staffEmail: schema.users.email,
      })
      .from(schema.staffBreaks)
      .innerJoin(
        schema.staffMembers,
        eq(schema.staffBreaks.staffId, schema.staffMembers.id),
      )
      .innerJoin(schema.users, eq(schema.staffMembers.userId, schema.users.id))
      .where(whereClause)
      .orderBy(schema.staffBreaks.createdAt);
  }

  async delete(id: number): Promise<void> {
    const result = await this.db
      .delete(schema.staffBreaks)
      .where(eq(schema.staffBreaks.id, id))
      .returning();

    if (result.length === 0) {
      throw new NotFoundException(`Staff break with ID ${id} not found`);
    }
  }
}
