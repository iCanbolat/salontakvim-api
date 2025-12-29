import { categories } from '../../db/schema';

export type Category = typeof categories.$inferSelect;
export type NewCategory = typeof categories.$inferInsert;

export interface ICategoryRepository {
  create(data: NewCategory): Promise<Category>;
  findById(id: string): Promise<Category | null>;
  findByStoreId(storeId: string): Promise<Category[]>;
  findByIdAndStoreId(id: string, storeId: string): Promise<Category | null>;
  update(id: string, data: Partial<Category>): Promise<Category>;
  delete(id: string): Promise<void>;
  reorder(categoryIds: string[], storeId: string): Promise<void>;
  getMaxPosition(storeId: string): Promise<number>;
}
