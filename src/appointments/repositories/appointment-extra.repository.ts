import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DRIZZLE_ORM } from '../../db/drizzle.module';
import * as schema from '../../db/schema';
import {
  AppointmentExtra,
  NewAppointmentExtra,
} from '../interfaces/repository.interface';

@Injectable()
export class AppointmentExtraRepository {
  constructor(
    @Inject(DRIZZLE_ORM)
    private readonly db: any,
  ) {}

  async create(data: NewAppointmentExtra): Promise<AppointmentExtra> {
    const [extra] = await this.db
      .insert(schema.appointmentExtras)
      .values(data)
      .returning();
    return extra;
  }

  async createMany(data: NewAppointmentExtra[]): Promise<AppointmentExtra[]> {
    if (data.length === 0) return [];

    return await this.db
      .insert(schema.appointmentExtras)
      .values(data)
      .returning();
  }

  async findByAppointmentId(
    appointmentId: string,
  ): Promise<AppointmentExtra[]> {
    return await this.db
      .select()
      .from(schema.appointmentExtras)
      .where(eq(schema.appointmentExtras.appointmentId, appointmentId));
  }

  async deleteByAppointmentId(appointmentId: string): Promise<void> {
    await this.db
      .delete(schema.appointmentExtras)
      .where(eq(schema.appointmentExtras.appointmentId, appointmentId));
  }
}
