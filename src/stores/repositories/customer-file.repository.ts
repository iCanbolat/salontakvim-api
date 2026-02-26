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

export interface FolderStats {
  customerId: string;
  customerName: string;
  fileCount: number;
  totalSize: number;
  lastUploadedAt: Date;
}

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

  /**
   * Find all files for a store with optional filtering
   * If staffId is provided, only returns files from customers who have had appointments with that staff member
   */
  async findByStore(
    storeId: string,
    options?: {
      fileType?: string;
      search?: string;
      limit?: number;
      page?: number;
      staffId?: string; // For staff-only filtering
    },
  ): Promise<
    PaginatedResult<CustomerFile & { customerName?: string }> & {
      totalSize: number;
    }
  > {
    const pagination = this.normalizePagination(options);
    // Build base conditions
    const conditions = [eq(customerFiles.storeId, storeId)];

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

    // If staffId provided, filter to only customers who have appointments with this staff
    if (options?.staffId) {
      // Get distinct customer IDs that have appointments with this staff member
      const staffCustomerIds = await this.db
        .selectDistinct({ customerId: appointments.customerId })
        .from(appointments)
        .where(
          and(
            eq(appointments.storeId, storeId),
            eq(appointments.staffId, options.staffId),
          ),
        );

      const customerIds = staffCustomerIds.map((r) => r.customerId);

      if (customerIds.length === 0) {
        // Staff has no customers, return empty
        return {
          data: [],
          total: 0,
          page: pagination.page,
          limit: pagination.limit,
          totalPages: 0,
          totalSize: 0,
        } as any;
      }

      conditions.push(inArray(customerFiles.customerId, customerIds));
    }

    const whereClause = and(...conditions);

    // Get total size
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
        .offset(offset) as Promise<
        (CustomerFile & { customerName?: string })[]
      >;
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

  async getFolders(
    storeId: string,
    options?: {
      search?: string;
      limit?: number;
      page?: number;
    },
    context?: {
      userRole?: string;
      staffId?: string;
      locationId?: string;
    },
  ): Promise<PaginatedResult<FolderStats>> {
    const pagination = this.normalizePagination(options, 12);
    // Note: search in folders context usually means searching for customer name or filtering folders that contain specific files
    // But since customer names are not in customerFiles table, we can only filter by file properties here.
    // Ideally, "search" for folders should query the User table joined with files.
    // However, existing logic seems to fetch Customers list on frontend to get names.
    // Let's assume search filters files, and we return folders that contain those files.

    const conditions = [eq(customerFiles.storeId, storeId)];

    // Role-based filtering
    if (context?.userRole === 'staff' && context.staffId) {
      // Staff: Sadece kendi hizmet verdiği müşterileri görsün
      // Burada customerFiles.customerId'nin, appointments tablosunda staff_id = context.staffId olan bir kaydı olmalı
      conditions.push(
        exists(
          this.db
            .select()
            .from(appointments)
            .where(
              and(
                eq(appointments.customerId, customerFiles.customerId),
                eq(appointments.storeId, storeId),
                eq(appointments.staffId, context.staffId),
              ),
            ),
        ),
      );
    } else if (context?.userRole === 'manager' && context.locationId) {
      // Manager: Sadece kendi lokasyonundaki randevularla ilişkili müşterileri görsün
      conditions.push(
        exists(
          this.db
            .select()
            .from(appointments)
            .where(
              and(
                eq(appointments.customerId, customerFiles.customerId),
                eq(appointments.storeId, storeId),
                eq(appointments.locationId, context.locationId),
              ),
            ),
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

    const queryFactory = async (limit: number, offset: number) => {
      const result = await this.db
        .select({
          customerId: customerFiles.customerId,
          customerFirstName: users.firstName,
          customerLastName: users.lastName,
          customerEmail: users.email,
          fileCount: sql<number>`count(${customerFiles.id})::int`,
          totalSize: sql<number>`sum(${customerFiles.fileSize})::bigint`,
          lastUploadedAt: sql<Date>`max(${customerFiles.createdAt})`,
        })
        .from(customerFiles)
        .leftJoin(users, eq(customerFiles.customerId, users.id))
        .where(whereClause)
        .groupBy(
          customerFiles.customerId,
          users.id,
          users.firstName,
          users.lastName,
          users.email,
        )
        .orderBy(desc(sql`max(${customerFiles.createdAt})`))
        .limit(limit)
        .offset(offset);

      return result.map((r) => {
        const name =
          `${r.customerFirstName || ''} ${r.customerLastName || ''}`.trim() ||
          r.customerEmail ||
          'Unknown';
        return {
          customerId: r.customerId,
          customerName: name,
          fileCount: Number(r.fileCount),
          totalSize: Number(r.totalSize),
          lastUploadedAt: new Date(r.lastUploadedAt),
        };
      });
    };

    const countFactory = async () => {
      // Count distinct customers who match the file filter
      const [result] = await this.db
        .select({
          count: sql<number>`count(distinct ${customerFiles.customerId})::int`,
        })
        .from(customerFiles)
        .where(whereClause);
      return result?.count || 0;
    };

    return this.executePaginatedQuery(pagination, queryFactory, countFactory);
  }
}
