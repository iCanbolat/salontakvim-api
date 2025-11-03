import type * as schema from '../../db/schema';

export type WidgetSettings = typeof schema.widgetSettings.$inferSelect;
export type NewWidgetSettings = typeof schema.widgetSettings.$inferInsert;
