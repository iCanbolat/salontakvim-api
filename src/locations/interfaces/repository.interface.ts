import { locations } from '../../db/schema';

export type Location = typeof locations.$inferSelect;
export type NewLocation = typeof locations.$inferInsert;

export interface ILocationRepository {
  create(data: NewLocation): Promise<Location>;
  findById(id: number): Promise<Location | null>;
  findByStoreId(storeId: number): Promise<Location[]>;
  findByIdAndStoreId(id: number, storeId: number): Promise<Location | null>;
  findVisibleByStoreId(storeId: number): Promise<Location[]>;
  update(id: number, data: Partial<Location>): Promise<Location>;
  delete(id: number): Promise<void>;
}
