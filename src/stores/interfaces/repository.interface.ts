import { stores } from '../../db/schema';

export type Store = typeof stores.$inferSelect;
export type NewStore = typeof stores.$inferInsert;

export interface IStoreRepository {
  create(data: NewStore): Promise<Store>;
  findById(id: number): Promise<Store | null>;
  findBySlug(slug: string): Promise<Store | null>;
  findByOwnerId(ownerId: number): Promise<Store | null>;
  update(id: number, data: Partial<Store>): Promise<Store>;
  delete(id: number): Promise<void>;
  incrementAppointments(id: number): Promise<void>;
  incrementCustomers(id: number): Promise<void>;
  updateAnalytics(
    id: number,
    data: {
      totalAppointments?: number;
      totalCustomers?: number;
    },
  ): Promise<Store>;
}
