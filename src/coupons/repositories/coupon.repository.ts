import { Inject, Injectable } from '@nestjs/common';
import { eq, and, sql, desc, gte, lte, ilike, or } from 'drizzle-orm';
import {
  coupons,
  customerCoupons,
  couponUsages,
  users,
} from '../../db/schema';
import { DRIZZLE_ORM } from '../../db/drizzle.module';
import type { CreateCouponDto, UpdateCouponDto } from '../dto';

@Injectable()
export class CouponRepository {
  constructor(@Inject(DRIZZLE_ORM) private db: any) {}

  async create(storeId: string, dto: CreateCouponDto, createdBy: string) {
    const [coupon] = await this.db
      .insert(coupons)
      .values({
        storeId,
        code: dto.code.toUpperCase(),
        name: dto.name,
        description: dto.description,
        type: dto.type,
        value: dto.value.toString(),
        minPurchaseAmount: dto.minPurchaseAmount?.toString(),
        maxDiscountAmount: dto.maxDiscountAmount?.toString(),
        usageLimit: dto.usageLimit,
        usageLimitPerCustomer: dto.usageLimitPerCustomer ?? 1,
        validFrom: new Date(dto.validFrom),
        validUntil: new Date(dto.validUntil),
        isActive: dto.isActive ?? true,
        applicableServiceIds: dto.applicableServiceIds,
        createdBy,
      })
      .returning();

    return coupon;
  }

  async findById(id: string, storeId: string) {
    const [coupon] = await this.db
      .select()
      .from(coupons)
      .where(and(eq(coupons.id, id), eq(coupons.storeId, storeId)));

    return coupon;
  }

  async findByCode(code: string, storeId: string) {
    const [coupon] = await this.db
      .select()
      .from(coupons)
      .where(
        and(
          eq(coupons.code, code.toUpperCase()),
          eq(coupons.storeId, storeId),
        ),
      );

    return coupon;
  }

  async findAll(
    storeId: string,
    options?: {
      search?: string;
      isActive?: boolean;
      includeExpired?: boolean;
    },
  ) {
    const conditions = [eq(coupons.storeId, storeId)];

    if (options?.search) {
      conditions.push(
        or(
          ilike(coupons.code, `%${options.search}%`),
          ilike(coupons.name, `%${options.search}%`),
        ) as any,
      );
    }

    if (options?.isActive !== undefined) {
      conditions.push(eq(coupons.isActive, options.isActive));
    }

    if (!options?.includeExpired) {
      conditions.push(gte(coupons.validUntil, new Date()));
    }

    return this.db
      .select()
      .from(coupons)
      .where(and(...conditions))
      .orderBy(desc(coupons.createdAt));
  }

  async update(id: string, storeId: string, dto: UpdateCouponDto) {
    const updateData: Record<string, any> = {
      updatedAt: new Date(),
    };

    if (dto.code !== undefined) updateData.code = dto.code.toUpperCase();
    if (dto.name !== undefined) updateData.name = dto.name;
    if (dto.description !== undefined) updateData.description = dto.description;
    if (dto.type !== undefined) updateData.type = dto.type;
    if (dto.value !== undefined) updateData.value = dto.value.toString();
    if (dto.minPurchaseAmount !== undefined)
      updateData.minPurchaseAmount = dto.minPurchaseAmount?.toString();
    if (dto.maxDiscountAmount !== undefined)
      updateData.maxDiscountAmount = dto.maxDiscountAmount?.toString();
    if (dto.usageLimit !== undefined) updateData.usageLimit = dto.usageLimit;
    if (dto.usageLimitPerCustomer !== undefined)
      updateData.usageLimitPerCustomer = dto.usageLimitPerCustomer;
    if (dto.validFrom !== undefined)
      updateData.validFrom = new Date(dto.validFrom);
    if (dto.validUntil !== undefined)
      updateData.validUntil = new Date(dto.validUntil);
    if (dto.isActive !== undefined) updateData.isActive = dto.isActive;
    if (dto.applicableServiceIds !== undefined)
      updateData.applicableServiceIds = dto.applicableServiceIds;

    const [coupon] = await this.db
      .update(coupons)
      .set(updateData)
      .where(and(eq(coupons.id, id), eq(coupons.storeId, storeId)))
      .returning();

    return coupon;
  }

  async delete(id: string, storeId: string) {
    await this.db
      .delete(coupons)
      .where(and(eq(coupons.id, id), eq(coupons.storeId, storeId)));
  }

  async incrementUsedCount(id: string) {
    await this.db
      .update(coupons)
      .set({
        usedCount: sql`${coupons.usedCount} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(coupons.id, id));
  }

  // Customer Coupon methods
  async assignToCustomers(
    couponId: string,
    storeId: string,
    customerIds: string[],
    assignedBy: string,
    notify: boolean = false,
  ) {
    const values = customerIds.map((customerId) => ({
      couponId,
      customerId,
      storeId,
      assignedBy,
      status: 'active' as const,
      notifiedAt: notify ? new Date() : null,
    }));

    return this.db
      .insert(customerCoupons)
      .values(values)
      .onConflictDoNothing()
      .returning();
  }

  async findCustomerCoupon(couponId: string, customerId: string) {
    const [assignment] = await this.db
      .select()
      .from(customerCoupons)
      .where(
        and(
          eq(customerCoupons.couponId, couponId),
          eq(customerCoupons.customerId, customerId),
        ),
      );

    return assignment;
  }

  async findCustomerCoupons(customerId: string, storeId: string) {
    return this.db
      .select({
        customerCoupon: customerCoupons,
        coupon: coupons,
      })
      .from(customerCoupons)
      .innerJoin(coupons, eq(customerCoupons.couponId, coupons.id))
      .where(
        and(
          eq(customerCoupons.customerId, customerId),
          eq(customerCoupons.storeId, storeId),
          eq(customerCoupons.status, 'active'),
          eq(coupons.isActive, true),
          gte(coupons.validUntil, new Date()),
        ),
      );
  }

  async findCouponAssignments(couponId: string, storeId: string) {
    return this.db
      .select({
        customerCoupon: customerCoupons,
        customer: {
          id: users.id,
          email: users.email,
          firstName: users.firstName,
          lastName: users.lastName,
          phone: users.phone,
        },
      })
      .from(customerCoupons)
      .innerJoin(users, eq(customerCoupons.customerId, users.id))
      .where(
        and(
          eq(customerCoupons.couponId, couponId),
          eq(customerCoupons.storeId, storeId),
        ),
      );
  }

  async updateCustomerCouponStatus(
    couponId: string,
    customerId: string,
    status: 'active' | 'expired' | 'used' | 'cancelled',
  ) {
    const updateData: Record<string, any> = { status };
    if (status === 'used') {
      updateData.usedAt = new Date();
      updateData.usedCount = sql`${customerCoupons.usedCount} + 1`;
    }

    const [updated] = await this.db
      .update(customerCoupons)
      .set(updateData)
      .where(
        and(
          eq(customerCoupons.couponId, couponId),
          eq(customerCoupons.customerId, customerId),
        ),
      )
      .returning();

    return updated;
  }

  async removeCustomerCoupon(couponId: string, customerId: string) {
    await this.db
      .delete(customerCoupons)
      .where(
        and(
          eq(customerCoupons.couponId, couponId),
          eq(customerCoupons.customerId, customerId),
        ),
      );
  }

  // Usage tracking
  async recordUsage(
    couponId: string,
    storeId: string,
    customerId: string | null,
    appointmentId: string | null,
    discountAmount: number,
    originalAmount: number,
  ) {
    const [usage] = await this.db
      .insert(couponUsages)
      .values({
        couponId,
        storeId,
        customerId,
        appointmentId,
        discountAmount: discountAmount.toString(),
        originalAmount: originalAmount.toString(),
      })
      .returning();

    return usage;
  }

  async getCouponStats(couponId: string, storeId: string) {
    const [stats] = await this.db
      .select({
        assignedCount: sql<number>`count(distinct ${customerCoupons.customerId})`,
        totalUsages: sql<number>`count(${couponUsages.id})`,
        totalDiscountGiven: sql<string>`coalesce(sum(${couponUsages.discountAmount}), '0')`,
      })
      .from(coupons)
      .leftJoin(customerCoupons, eq(coupons.id, customerCoupons.couponId))
      .leftJoin(couponUsages, eq(coupons.id, couponUsages.couponId))
      .where(and(eq(coupons.id, couponId), eq(coupons.storeId, storeId)))
      .groupBy(coupons.id);

    return stats;
  }
}
