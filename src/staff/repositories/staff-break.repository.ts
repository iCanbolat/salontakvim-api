import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { eq, and, gte, lte } from 'drizzle-orm';
import { DRIZZLE_ORM } from '../../db/drizzle.module';
import * as schema from '../../db/schema';
import { StaffBreak, NewStaffBreak } from '../interfaces/repository.interface';

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
