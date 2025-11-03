import { services, serviceExtras } from '../../db/schema';

export type Service = typeof services.$inferSelect;
export type NewService = typeof services.$inferInsert;

export type ServiceExtra = typeof serviceExtras.$inferSelect;
export type NewServiceExtra = typeof serviceExtras.$inferInsert;

export interface IServiceRepository {
  create(data: NewService): Promise<Service>;
  findById(id: number): Promise<Service | null>;
  findByStoreId(storeId: number): Promise<Service[]>;
  findByIdAndStoreId(id: number, storeId: number): Promise<Service | null>;
  findByCategoryId(categoryId: number): Promise<Service[]>;
  findVisibleByStoreId(storeId: number): Promise<Service[]>;
  update(id: number, data: Partial<Service>): Promise<Service>;
  delete(id: number): Promise<void>;
  getMaxPosition(storeId: number): Promise<number>;
}
