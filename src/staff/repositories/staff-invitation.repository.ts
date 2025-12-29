import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { eq, and } from 'drizzle-orm';
import { DRIZZLE_ORM } from '../../db/drizzle.module';
import * as schema from '../../db/schema';
import {
  StaffInvitation,
  NewStaffInvitation,
} from '../interfaces/repository.interface';

@Injectable()
export class StaffInvitationRepository {
  constructor(
    @Inject(DRIZZLE_ORM)
    private readonly db: any,
  ) {}

  async create(data: NewStaffInvitation): Promise<StaffInvitation> {
    const [invitation] = await this.db
      .insert(schema.staffInvitations)
      .values(data)
      .returning();
    return invitation;
  }

  async findById(id: string): Promise<StaffInvitation | null> {
    const [invitation] = await this.db
      .select()
      .from(schema.staffInvitations)
      .where(eq(schema.staffInvitations.id, id))
      .limit(1);
    return invitation || null;
  }

  async findByToken(token: string): Promise<StaffInvitation | null> {
    const [invitation] = await this.db
      .select()
      .from(schema.staffInvitations)
      .where(eq(schema.staffInvitations.token, token))
      .limit(1);
    return invitation || null;
  }

  async findByStoreId(storeId: string): Promise<StaffInvitation[]> {
    return await this.db
      .select()
      .from(schema.staffInvitations)
      .where(eq(schema.staffInvitations.storeId, storeId));
  }

  async findByEmail(email: string): Promise<StaffInvitation | null> {
    const [invitation] = await this.db
      .select()
      .from(schema.staffInvitations)
      .where(eq(schema.staffInvitations.email, email))
      .limit(1);
    return invitation || null;
  }

  async findPendingByEmailAndStore(
    email: string,
    storeId: string,
  ): Promise<StaffInvitation | null> {
    const [invitation] = await this.db
      .select()
      .from(schema.staffInvitations)
      .where(
        and(
          eq(schema.staffInvitations.email, email),
          eq(schema.staffInvitations.storeId, storeId),
          eq(schema.staffInvitations.status, 'pending'),
        ),
      )
      .limit(1);
    return invitation || null;
  }

  async update(
    id: string,
    data: Partial<StaffInvitation>,
  ): Promise<StaffInvitation> {
    const [updatedInvitation] = await this.db
      .update(schema.staffInvitations)
      .set(data)
      .where(eq(schema.staffInvitations.id, id))
      .returning();

    if (!updatedInvitation) {
      throw new NotFoundException(`Invitation with ID ${id} not found`);
    }

    return updatedInvitation;
  }

  async delete(id: string): Promise<void> {
    const result = await this.db
      .delete(schema.staffInvitations)
      .where(eq(schema.staffInvitations.id, id))
      .returning();

    if (result.length === 0) {
      throw new NotFoundException(`Invitation with ID ${id} not found`);
    }
  }
}
