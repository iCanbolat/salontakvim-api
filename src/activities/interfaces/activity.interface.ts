import * as schema from '../../db/schema';

export type Activity = typeof schema.activities.$inferSelect;
export type NewActivity = typeof schema.activities.$inferInsert;
export type ActivityType = Activity['type'];
