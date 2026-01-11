import { Injectable, Inject } from '@nestjs/common';
import { eq, and, desc, sql, ilike, or, inArray } from 'drizzle-orm';
import { DRIZZLE_ORM } from '../../db/drizzle.module';
import { customerFiles } from '../../db/schema';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type * as schema from '../../db/schema';

export interface CustomerFile {
  id: string;
  storeId: string;
  customerId: string;
  uploadedBy: string | null;
  fileName: string;
  originalName: string;
  mimeType: string;
  fileType: string;
  fileSize: number;
  storagePath: string;
  storageProvider: string;
  description: string | null;
  tags: string[] | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateCustomerFileData {
  storeId: string;
  customerId: string;
  uploadedBy?: string;
  fileName: string;
  originalName: string;
  mimeType: string;
  fileType: 'image' | 'pdf' | 'document' | 'other';
  fileSize: number;
  storagePath: string;
  storageProvider?: string;
  description?: string;
  tags?: string[];
}

export interface UpdateCustomerFileData {
  description?: string;
  tags?: string[];
}

@Injectable()
export class CustomerFileRepository {
  constructor(
    @Inject(DRIZZLE_ORM)
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  async create(data: CreateCustomerFileData): Promise<CustomerFile> {
    const [file] = await this.db
      .insert(customerFiles)
      .values({
        storeId: data.storeId,
        customerId: data.customerId,
        uploadedBy: data.uploadedBy,
        fileName: data.fileName,
        originalName: data.originalName,
        mimeType: data.mimeType,
        fileType: data.fileType,
        fileSize: data.fileSize,
        storagePath: data.storagePath,
        storageProvider: data.storageProvider || 'local',
        description: data.description,
        tags: data.tags,
      })
      .returning();

    return file as CustomerFile;
  }

  async findById(id: string): Promise<CustomerFile | null> {
    const [file] = await this.db
      .select()
      .from(customerFiles)
      .where(eq(customerFiles.id, id))
      .limit(1);

    return (file as CustomerFile) || null;
  }

  async findByStoreAndId(
    storeId: string,
    customerId: string,
    id: string,
  ): Promise<CustomerFile | null> {
    const [file] = await this.db
      .select()
      .from(customerFiles)
      .where(
        and(
          eq(customerFiles.storeId, storeId),
          eq(customerFiles.customerId, customerId),
          eq(customerFiles.id, id),
        ),
      )
      .limit(1);

    return (file as CustomerFile) || null;
  }

  async findByCustomer(
    storeId: string,
    customerId: string,
    options?: {
      fileType?: string;
      search?: string;
      limit?: number;
      offset?: number;
    },
  ): Promise<{ files: CustomerFile[]; total: number; totalSize: number }> {
    const conditions = [
      eq(customerFiles.storeId, storeId),
      eq(customerFiles.customerId, customerId),
    ];

    if (options?.fileType) {
      conditions.push(
        eq(
          customerFiles.fileType,
          options.fileType as 'image' | 'pdf' | 'document' | 'other',
        ),
      );
    }

    if (options?.search) {
      conditions.push(
        or(
          ilike(customerFiles.originalName, `%${options.search}%`),
          ilike(customerFiles.description, `%${options.search}%`),
        )!,
      );
    }

    // Get total count and total size
    const [stats] = await this.db
      .select({
        total: sql<number>`count(*)::int`,
        totalSize: sql<number>`coalesce(sum(${customerFiles.fileSize}), 0)::bigint`,
      })
      .from(customerFiles)
      .where(and(...conditions));

    // Get files with pagination
    let query = this.db
      .select()
      .from(customerFiles)
      .where(and(...conditions))
      .orderBy(desc(customerFiles.createdAt));

    if (options?.limit) {
      query = query.limit(options.limit) as typeof query;
    }
    if (options?.offset) {
      query = query.offset(options.offset) as typeof query;
    }

    const files = await query;

    return {
      files: files as CustomerFile[],
      total: stats?.total || 0,
      totalSize: Number(stats?.totalSize) || 0,
    };
  }

  async update(
    id: string,
    data: UpdateCustomerFileData,
  ): Promise<CustomerFile> {
    const [file] = await this.db
      .update(customerFiles)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(customerFiles.id, id))
      .returning();

    return file as CustomerFile;
  }

  async delete(id: string): Promise<void> {
    await this.db.delete(customerFiles).where(eq(customerFiles.id, id));
  }

  async deleteMany(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    await this.db.delete(customerFiles).where(inArray(customerFiles.id, ids));
  }

  async deleteByCustomer(
    storeId: string,
    customerId: string,
  ): Promise<CustomerFile[]> {
    const files = await this.db
      .delete(customerFiles)
      .where(
        and(
          eq(customerFiles.storeId, storeId),
          eq(customerFiles.customerId, customerId),
        ),
      )
      .returning();

    return files as CustomerFile[];
  }
}
