import { locations } from '../../db/schema';

export type Location = typeof locations.$inferSelect;
export type NewLocation = typeof locations.$inferInsert;

export interface ILocationRepository {
  create(data: NewLocation): Promise<Location>;
  findById(id: string): Promise<Location | null>;
  findByStoreId(storeId: string): Promise<Location[]>;
  findByIdAndStoreId(id: string, storeId: string): Promise<Location | null>;
  findVisibleByStoreId(storeId: string): Promise<Location[]>;
  update(id: string, data: Partial<Location>): Promise<Location>;
  delete(id: string): Promise<void>;
}
