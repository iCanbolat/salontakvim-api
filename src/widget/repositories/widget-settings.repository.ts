import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DRIZZLE_ORM } from '../../db/drizzle.module';
import * as schema from '../../db/schema';
import {
  WidgetSettings,
  NewWidgetSettings,
} from '../interfaces/repository.interface';
import { randomBytes } from 'crypto';

@Injectable()
export class WidgetSettingsRepository {
  constructor(
    @Inject(DRIZZLE_ORM)
    private readonly db: any,
  ) {}

  async create(data: NewWidgetSettings): Promise<WidgetSettings> {
    const [widgetSettings] = await this.db
      .insert(schema.widgetSettings)
      .values(data)
      .returning();
    return widgetSettings;
  }

  async findByStoreId(storeId: number): Promise<WidgetSettings | null> {
    const [widgetSettings] = await this.db
      .select()
      .from(schema.widgetSettings)
      .where(eq(schema.widgetSettings.storeId, storeId))
      .limit(1);
    return widgetSettings || null;
  }

  async findByWidgetKey(widgetKey: string): Promise<WidgetSettings | null> {
    const [widgetSettings] = await this.db
      .select()
      .from(schema.widgetSettings)
      .where(eq(schema.widgetSettings.widgetKey, widgetKey))
      .limit(1);
    return widgetSettings || null;
  }

  async update(
    storeId: number,
    data: Partial<WidgetSettings>,
  ): Promise<WidgetSettings> {
    const [updatedWidgetSettings] = await this.db
      .update(schema.widgetSettings)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(schema.widgetSettings.storeId, storeId))
      .returning();

    if (!updatedWidgetSettings) {
      throw new NotFoundException(
        `Widget settings for store ${storeId} not found`,
      );
    }

    return updatedWidgetSettings;
  }

  async delete(storeId: number): Promise<void> {
    const result = await this.db
      .delete(schema.widgetSettings)
      .where(eq(schema.widgetSettings.storeId, storeId))
      .returning();

    if (result.length === 0) {
      throw new NotFoundException(
        `Widget settings for store ${storeId} not found`,
      );
    }
  }

  generateWidgetKey(): string {
    return randomBytes(32).toString('hex');
  }
}
