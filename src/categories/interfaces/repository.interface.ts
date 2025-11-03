import { categories } from '../../db/schema';

export type Category = typeof categories.$inferSelect;
export type NewCategory = typeof categories.$inferInsert;

export interface ICategoryRepository {
  create(data: NewCategory): Promise<Category>;
  findById(id: number): Promise<Category | null>;
  findByStoreId(storeId: number): Promise<Category[]>;
  findByIdAndStoreId(id: number, storeId: number): Promise<Category | null>;
  update(id: number, data: Partial<Category>): Promise<Category>;
  delete(id: number): Promise<void>;
  reorder(categoryIds: number[], storeId: number): Promise<void>;
  getMaxPosition(storeId: number): Promise<number>;
}
