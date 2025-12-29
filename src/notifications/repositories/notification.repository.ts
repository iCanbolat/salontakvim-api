import { Inject, Injectable } from '@nestjs/common';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { and, eq } from 'drizzle-orm';
import { DRIZZLE_ORM } from '../../db/drizzle.module';
import * as schema from '../../db/schema';

@Injectable()
export class NotificationRepository {
  constructor(
    @Inject(DRIZZLE_ORM)
    private readonly db: PostgresJsDatabase<typeof schema>,
  ) {}

  /**
   * Get notification settings for a store
   */
  async getSettings(storeId: string) {
    return this.db.query.notificationSettings.findFirst({
      where: eq(schema.notificationSettings.storeId, storeId),
    });
  }

  /**
   * Create default notification settings for a store
   */
  async createDefaultSettings(storeId: string) {
    const defaultSettings = {
      storeId,
      appointmentConfirmationEnabled: true,
      appointmentConfirmationChannel: 'email' as const,
      appointmentReminderEnabled: true,
      appointmentReminderChannel: 'email' as const,
      reminder24hEnabled: true,
      reminder1hEnabled: true,
      appointmentCancellationEnabled: true,
      appointmentCancellationChannel: 'email' as const,
      appointmentRescheduledEnabled: true,
      appointmentRescheduledChannel: 'email' as const,
      staffInvitationEnabled: true,
      senderEmail: null,
      senderName: null,
      replyToEmail: null,
      emailProvider: 'smtp',
      smsProvider: null,
    };

    const [settings] = await this.db
      .insert(schema.notificationSettings)
      .values(defaultSettings as any)
      .returning();

    return settings;
  }

  /**
   * Update notification settings
   */
  async updateSettings(
    storeId: string,
    data: Partial<typeof schema.notificationSettings.$inferInsert>,
  ) {
    const existing = await this.getSettings(storeId);

    if (existing) {
      // Update existing settings
      const [updated] = await this.db
        .update(schema.notificationSettings)
        .set({
          ...data,
          updatedAt: new Date(),
        })
        .where(eq(schema.notificationSettings.storeId, storeId))
        .returning();

      return updated;
    } else {
      // Create new settings with provided data
      const [created] = await this.db
        .insert(schema.notificationSettings)
        .values({
          storeId,
          ...data,
        } as any)
        .returning();

      return created;
    }
  }

  /**
   * Get or create notification settings
   */
  async getOrCreateSettings(storeId: string) {
    const existing = await this.getSettings(storeId);

    if (existing) {
      return existing;
    }

    return this.createDefaultSettings(storeId);
  }

  async createNotification(data: typeof schema.notifications.$inferInsert) {
    const [notification] = await this.db
      .insert(schema.notifications)
      .values(data)
      .returning();

    return notification;
  }

  async getUserNotifications(userId: string, limit = 20) {
    return this.db.query.notifications.findMany({
      where: eq(schema.notifications.userId, userId),
      orderBy: (notifications, { desc }) => [desc(notifications.createdAt)],
      limit,
    });
  }

  async markAsRead(id: string, userId: string) {
    const [updated] = await this.db
      .update(schema.notifications)
      .set({ isRead: true })
      .where(
        and(
          eq(schema.notifications.id, id),
          eq(schema.notifications.userId, userId),
        ),
      )
      .returning();

    return updated;
  }

  async markAllAsRead(userId: string) {
    return this.db
      .update(schema.notifications)
      .set({ isRead: true })
      .where(eq(schema.notifications.userId, userId))
      .returning();
  }
}
