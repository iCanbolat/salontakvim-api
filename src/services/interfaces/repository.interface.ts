import { services, serviceExtras } from '../../db/schema';

export type Service = typeof services.$inferSelect;
export type NewService = typeof services.$inferInsert;

export type ServiceExtra = typeof serviceExtras.$inferSelect;
export type NewServiceExtra = typeof serviceExtras.$inferInsert;

export interface IServiceRepository {
  create(data: NewService): Promise<Service>;
  findById(id: string): Promise<Service | null>;
  findByStoreId(storeId: string): Promise<any[]>;
  findByIdAndStoreId(id: string, storeId: string): Promise<any | null>;
  findByCategoryId(categoryId: string): Promise<Service[]>;
  findVisibleByStoreId(storeId: string): Promise<any[]>;
  update(id: string, data: Partial<Service>): Promise<Service>;
  delete(id: string): Promise<void>;
  getMaxPosition(storeId: string): Promise<number>;
}
