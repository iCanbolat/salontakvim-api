import { Injectable, Inject } from '@nestjs/common';
import { eq, and, desc, sql, ilike, or, inArray, exists } from 'drizzle-orm';
import { DRIZZLE_ORM } from '../../db/drizzle.module';
import { customerFiles, appointments, services } from '../../db/schema';
import {
  BaseRepository,
  PaginatedResult,
} from '../../common/repositories/base.repository';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type * as schema from '../../db/schema';

export interface CustomerFile {
  id: string;
  storeId: string;
  customerId: string;
  uploadedBy: string | null;
  appointmentId: string | null;
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

import { users } from '../../db/schema';

export interface CreateCustomerFileData {
  storeId: string;
  customerId: string;
  uploadedBy?: string;
  appointmentId?: string;
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
export class CustomerFileRepository extends BaseRepository<CustomerFile> {
  constructor(
    @Inject(DRIZZLE_ORM)
    protected readonly db: NodePgDatabase<typeof schema>,
  ) {
    super(db);
  }

  async create(data: CreateCustomerFileData): Promise<CustomerFile> {
    const [file] = await this.db
      .insert(customerFiles)
      .values({
        storeId: data.storeId,
        customerId: data.customerId,
        uploadedBy: data.uploadedBy,
        appointmentId: data.appointmentId,
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

  async findAppointmentSummary(
    storeId: string,
    appointmentId: string,
    customerId: string,
  ): Promise<{
    id: string;
    status: string;
    serviceId: string | null;
    staffId: string | null;
    publicNumber: string | null;
    startDateTime: Date | null;
  } | null> {
    const [appointment] = await this.db
      .select({
        id: appointments.id,
        status: appointments.status,
        serviceId: appointments.serviceId,
        staffId: appointments.staffId,
        publicNumber: appointments.publicNumber,
        startDateTime: appointments.startDateTime,
      })
      .from(appointments)
      .where(
        and(
          eq(appointments.id, appointmentId),
          eq(appointments.storeId, storeId),
          eq(appointments.customerId, customerId),
        ),
      )
      .limit(1);

    return appointment || null;
  }

  async findServiceNameById(serviceId: string): Promise<string | null> {
    const [service] = await this.db
      .select({ name: services.name })
      .from(services)
      .where(eq(services.id, serviceId))
      .limit(1);

    return service?.name || null;
  }

  async findByCustomer(
    storeId: string,
    customerId: string,
    options?: {
      fileType?: string;
      search?: string;
      appointmentId?: string;
      limit?: number;
      page?: number;
    },
  ): Promise<PaginatedResult<CustomerFile> & { totalSize: number }> {
    const pagination = this.normalizePagination(options);
    const conditions = [
      eq(customerFiles.storeId, storeId),
      eq(customerFiles.customerId, customerId),
    ];

    if (options?.appointmentId) {
      conditions.push(eq(customerFiles.appointmentId, options.appointmentId));
    }

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
          sql<boolean>`coalesce(${customerFiles.tags}::text, '') ilike ${`%${options.search}%`}`,
        )!,
      );
    }

    const whereClause = and(...conditions);

    // Get total size separatly since generic pagination doesn't return it
    const [stats] = await this.db
      .select({
        totalSize: sql<number>`coalesce(sum(${customerFiles.fileSize}), 0)::bigint`,
      })
      .from(customerFiles)
      .where(whereClause);

    const queryFactory = async (limit: number, offset: number) => {
      return this.db
        .select()
        .from(customerFiles)
        .where(whereClause)
        .orderBy(desc(customerFiles.createdAt))
        .limit(limit)
        .offset(offset) as Promise<CustomerFile[]>;
    };

    const countFactory = async () => {
      const [result] = await this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(customerFiles)
        .where(whereClause);
      return result?.count || 0;
    };

    const result = await this.executePaginatedQuery(
      pagination,
      queryFactory,
      countFactory,
    );

    return {
      ...result,
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
