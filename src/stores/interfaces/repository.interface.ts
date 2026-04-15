import { stores } from '../../db/schema';

export type Store = typeof stores.$inferSelect;
export type NewStore = typeof stores.$inferInsert;

export interface IStoreRepository {
  create(data: NewStore): Promise<Store>;
  findById(id: string): Promise<Store | null>;
  findBySlug(slug: string): Promise<Store | null>;
  findByOwnerId(ownerId: string): Promise<Store | null>;
  findByStripeCustomerId(stripeCustomerId: string): Promise<Store | null>;
  findByStripeSubscriptionId(
    stripeSubscriptionId: string,
  ): Promise<Store | null>;
  findByCreemCustomerId(creemCustomerId: string): Promise<Store | null>;
  findByCreemSubscriptionId(creemSubscriptionId: string): Promise<Store | null>;
  update(id: string, data: Partial<Store>): Promise<Store>;
  delete(id: string): Promise<void>;
  incrementAppointments(id: string): Promise<void>;
  incrementCustomers(id: string): Promise<void>;
  updateAnalytics(
    id: string,
    data: {
      totalAppointments?: number;
      totalCustomers?: number;
    },
  ): Promise<Store>;
}
