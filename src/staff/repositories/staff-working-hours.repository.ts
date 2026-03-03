import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { eq, and } from 'drizzle-orm';
import { DRIZZLE_ORM } from '../../db/drizzle.module';
import * as schema from '../../db/schema';
import {
  StaffWorkingHours,
  NewStaffWorkingHours,
} from '../interfaces/repository.interface';

@Injectable()
export class StaffWorkingHoursRepository {
  constructor(
    @Inject(DRIZZLE_ORM)
    private readonly db: any,
  ) {}

  async create(data: NewStaffWorkingHours): Promise<StaffWorkingHours> {
    const [workingHours] = await this.db
      .insert(schema.staffWorkingHours)
      .values(data)
      .returning();
    return workingHours;
  }

  async findById(id: string): Promise<StaffWorkingHours | null> {
    const [workingHours] = await this.db
      .select()
      .from(schema.staffWorkingHours)
      .where(eq(schema.staffWorkingHours.id, id))
      .limit(1);
    return workingHours || null;
  }

  async findByStaffId(staffId: string): Promise<StaffWorkingHours[]> {
    return await this.db
      .select()
      .from(schema.staffWorkingHours)
      .where(eq(schema.staffWorkingHours.staffId, staffId));
  }

  async findActiveByStaffId(staffId: string): Promise<StaffWorkingHours[]> {
    return await this.db
      .select()
      .from(schema.staffWorkingHours)
      .where(
        and(
          eq(schema.staffWorkingHours.staffId, staffId),
          eq(schema.staffWorkingHours.isActive, true),
        ),
      );
  }

  async findByIdAndStaffId(
    id: string,
    staffId: string,
  ): Promise<StaffWorkingHours | null> {
    const [workingHours] = await this.db
      .select()
      .from(schema.staffWorkingHours)
      .where(
        and(
          eq(schema.staffWorkingHours.id, id),
          eq(schema.staffWorkingHours.staffId, staffId),
        ),
      )
      .limit(1);
    return workingHours || null;
  }

  async update(
    id: string,
    data: Partial<StaffWorkingHours>,
  ): Promise<StaffWorkingHours> {
    const [updatedWorkingHours] = await this.db
      .update(schema.staffWorkingHours)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(schema.staffWorkingHours.id, id))
      .returning();

    if (!updatedWorkingHours) {
      throw new NotFoundException(`Working hours with ID ${id} not found`);
    }

    return updatedWorkingHours;
  }

  async findActiveByStaffIdAndDay(
    staffId: string,
    dayOfWeek:
      | 'monday'
      | 'tuesday'
      | 'wednesday'
      | 'thursday'
      | 'friday'
      | 'saturday'
      | 'sunday',
  ): Promise<StaffWorkingHours[]> {
    return await this.db
      .select()
      .from(schema.staffWorkingHours)
      .where(
        and(
          eq(schema.staffWorkingHours.staffId, staffId),
          eq(schema.staffWorkingHours.dayOfWeek, dayOfWeek),
          eq(schema.staffWorkingHours.isActive, true),
        ),
      );
  }

  async deleteByStaffId(staffId: string): Promise<void> {
    await this.db
      .delete(schema.staffWorkingHours)
      .where(eq(schema.staffWorkingHours.staffId, staffId));
  }

  async createMany(data: NewStaffWorkingHours[]): Promise<StaffWorkingHours[]> {
    if (data.length === 0) return [];
    return await this.db
      .insert(schema.staffWorkingHours)
      .values(data)
      .returning();
  }

  async delete(id: string): Promise<void> {
    const result = await this.db
      .delete(schema.staffWorkingHours)
      .where(eq(schema.staffWorkingHours.id, id))
      .returning();

    if (result.length === 0) {
      throw new NotFoundException(`Working hours with ID ${id} not found`);
    }
  }
}
