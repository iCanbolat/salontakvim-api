import { Inject, Injectable } from '@nestjs/common';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { and, eq, lt, sql } from 'drizzle-orm';
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
      reminder1hEnabled: false,
      appointmentCancellationEnabled: true,
      appointmentCancellationChannel: 'email' as const,
      appointmentRescheduledEnabled: true,
      appointmentRescheduledChannel: 'email' as const,
      feedbackRequestSmsEnabled: false,
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

  async getReminderEnabledSettings() {
    return this.db
      .select({
        storeId: schema.notificationSettings.storeId,
        appointmentReminderEnabled:
          schema.notificationSettings.appointmentReminderEnabled,
        appointmentReminderChannel:
          schema.notificationSettings.appointmentReminderChannel,
        reminder24hEnabled: schema.notificationSettings.reminder24hEnabled,
        reminder1hEnabled: schema.notificationSettings.reminder1hEnabled,
        storeSlug: schema.stores.slug,
        storeName: schema.stores.name,
        storePhone: schema.stores.phone,
        storeEmail: schema.stores.email,
      })
      .from(schema.notificationSettings)
      .innerJoin(
        schema.stores,
        eq(schema.notificationSettings.storeId, schema.stores.id),
      )
      .where(eq(schema.notificationSettings.appointmentReminderEnabled, true));
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

  async getUserNotificationsPaginated(
    userId: string,
    page = 1,
    limit = 20,
    status: 'all' | 'read' | 'unread' = 'all',
  ) {
    const offset = (page - 1) * limit;
    const conditions = [eq(schema.notifications.userId, userId)];

    if (status === 'read') {
      conditions.push(eq(schema.notifications.isRead, true));
    } else if (status === 'unread') {
      conditions.push(eq(schema.notifications.isRead, false));
    }

    const where = conditions.length > 1 ? and(...conditions) : conditions[0];

    const data = await this.db
      .select()
      .from(schema.notifications)
      .where(where)
      .orderBy(sql`${schema.notifications.createdAt} DESC`)
      .limit(limit)
      .offset(offset);

    const [countResult] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(schema.notifications)
      .where(where);

    const total = Number(countResult?.count ?? 0);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  }

  async deleteOlderThan(cutoff: Date) {
    const deleted = await this.db
      .delete(schema.notifications)
      .where(lt(schema.notifications.createdAt, cutoff))
      .returning({ id: schema.notifications.id });

    return deleted.length;
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
