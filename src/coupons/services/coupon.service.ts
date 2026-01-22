import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { CouponRepository } from '../repositories/coupon.repository';
import { StoreRepository } from '../../stores/repositories/store.repository';
import { StaffMemberRepository } from '../../staff/repositories/staff-member.repository';
import type {
  CreateCouponDto,
  UpdateCouponDto,
  CouponResponseDto,
  CustomerCouponResponseDto,
  CouponWithStatsDto,
} from '../dto';

@Injectable()
export class CouponService {
  constructor(
    private readonly couponRepository: CouponRepository,
    private readonly storeRepository: StoreRepository,
    private readonly staffMemberRepository: StaffMemberRepository,
  ) {}

  private async validateStoreAccess(storeId: string, userId: string) {
    const store = await this.storeRepository.findById(storeId);
    if (!store) {
      throw new NotFoundException('Store not found');
    }
    // Check if user is owner or staff of the store
    const isOwner = store.ownerId === userId;
    const staff = await this.staffMemberRepository.findByUserId(userId);
    const isStaff = staff?.storeId === storeId;

    if (!isOwner && !isStaff) {
      throw new BadRequestException('You do not have access to this store');
    }

    return store;
  }

  async create(
    storeId: string,
    userId: string,
    dto: CreateCouponDto,
  ): Promise<CouponResponseDto> {
    await this.validateStoreAccess(storeId, userId);

    // Check if coupon code already exists
    const existing = await this.couponRepository.findByCode(dto.code, storeId);
    if (existing) {
      throw new ConflictException('Coupon code already exists');
    }

    // Validate dates
    const validFrom = new Date(dto.validFrom);
    const validUntil = new Date(dto.validUntil);
    if (validUntil <= validFrom) {
      throw new BadRequestException(
        'Valid until date must be after valid from date',
      );
    }

    // Validate percentage value
    if (dto.type === 'percentage' && dto.value > 100) {
      throw new BadRequestException('Percentage value cannot exceed 100');
    }

    const coupon = await this.couponRepository.create(storeId, dto, userId);
    return coupon as CouponResponseDto;
  }

  async findById(
    storeId: string,
    couponId: string,
    userId: string,
  ): Promise<CouponWithStatsDto> {
    await this.validateStoreAccess(storeId, userId);

    const coupon = await this.couponRepository.findById(couponId, storeId);
    if (!coupon) {
      throw new NotFoundException('Coupon not found');
    }

    const stats = await this.couponRepository.getCouponStats(couponId, storeId);

    return {
      ...coupon,
      assignedCount: stats?.assignedCount ?? 0,
      totalDiscountGiven: stats?.totalDiscountGiven ?? '0',
    } as CouponWithStatsDto;
  }

  async findAll(
    storeId: string,
    userId: string,
    options?: {
      search?: string;
      isActive?: boolean;
      includeExpired?: boolean;
    },
  ): Promise<CouponResponseDto[]> {
    await this.validateStoreAccess(storeId, userId);

    const coupons = await this.couponRepository.findAll(storeId, options);
    return coupons as CouponResponseDto[];
  }

  async update(
    storeId: string,
    couponId: string,
    userId: string,
    dto: UpdateCouponDto,
  ): Promise<CouponResponseDto> {
    await this.validateStoreAccess(storeId, userId);

    const existing = await this.couponRepository.findById(couponId, storeId);
    if (!existing) {
      throw new NotFoundException('Coupon not found');
    }

    // Check if new code conflicts with existing
    if (dto.code && dto.code.toUpperCase() !== existing.code) {
      const codeExists = await this.couponRepository.findByCode(
        dto.code,
        storeId,
      );
      if (codeExists) {
        throw new ConflictException('Coupon code already exists');
      }
    }

    const coupon = await this.couponRepository.update(storeId, couponId, dto);
    return coupon as CouponResponseDto;
  }

  async delete(
    storeId: string,
    couponId: string,
    userId: string,
  ): Promise<void> {
    await this.validateStoreAccess(storeId, userId);

    const existing = await this.couponRepository.findById(couponId, storeId);
    if (!existing) {
      throw new NotFoundException('Coupon not found');
    }

    await this.couponRepository.delete(couponId, storeId);
  }

  async assignToCustomers(
    storeId: string,
    couponId: string,
    customerIds: string[],
    userId: string,
    notify: boolean = false,
  ): Promise<CustomerCouponResponseDto[]> {
    await this.validateStoreAccess(storeId, userId);

    const coupon = await this.couponRepository.findById(couponId, storeId);
    if (!coupon) {
      throw new NotFoundException('Coupon not found');
    }

    if (!coupon.isActive) {
      throw new BadRequestException('Coupon is not active');
    }

    if (new Date(coupon.validUntil) < new Date()) {
      throw new BadRequestException('Coupon has expired');
    }

    const assignments = await this.couponRepository.assignToCustomers(
      couponId,
      storeId,
      customerIds,
      userId,
      notify,
    );

    // TODO: If notify is true, send notification to customers

    return assignments as CustomerCouponResponseDto[];
  }

  async getCustomerCoupons(
    storeId: string,
    customerId: string,
    userId: string,
  ): Promise<CustomerCouponResponseDto[]> {
    await this.validateStoreAccess(storeId, userId);

    const coupons = await this.couponRepository.findCustomerCoupons(
      customerId,
      storeId,
    );

    return coupons.map(({ customerCoupon, coupon }) => ({
      ...customerCoupon,
      coupon,
    })) as CustomerCouponResponseDto[];
  }

  async getCouponAssignments(
    storeId: string,
    couponId: string,
    userId: string,
  ) {
    await this.validateStoreAccess(storeId, userId);

    const coupon = await this.couponRepository.findById(couponId, storeId);
    if (!coupon) {
      throw new NotFoundException('Coupon not found');
    }

    return this.couponRepository.findCouponAssignments(couponId, storeId);
  }

  async removeCustomerCoupon(
    storeId: string,
    couponId: string,
    customerId: string,
    userId: string,
  ): Promise<void> {
    await this.validateStoreAccess(storeId, userId);

    await this.couponRepository.removeCustomerCoupon(couponId, customerId);
  }

  // Validate and apply coupon (for widget/booking)
  async validateCoupon(
    storeId: string,
    code: string,
    customerId?: string,
    serviceId?: string,
    amount?: number,
  ) {
    const coupon = await this.couponRepository.findByCode(code, storeId);

    if (!coupon) {
      throw new NotFoundException('Coupon not found');
    }

    if (!coupon.isActive) {
      throw new BadRequestException('Coupon is not active');
    }

    const now = new Date();
    if (now < new Date(coupon.validFrom)) {
      throw new BadRequestException('Coupon is not yet valid');
    }

    if (now > new Date(coupon.validUntil)) {
      throw new BadRequestException('Coupon has expired');
    }

    // Check usage limit
    if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) {
      throw new BadRequestException('Coupon usage limit reached');
    }

    // Check minimum purchase amount
    if (
      coupon.minPurchaseAmount &&
      amount &&
      amount < parseFloat(coupon.minPurchaseAmount)
    ) {
      throw new BadRequestException(
        `Minimum purchase amount is ${coupon.minPurchaseAmount}`,
      );
    }

    // Check applicable services
    if (coupon.applicableServiceIds && serviceId) {
      const applicableServices = coupon.applicableServiceIds as string[];
      if (!applicableServices.includes(serviceId)) {
        throw new BadRequestException(
          'Coupon is not applicable for this service',
        );
      }
    }

    // Check customer-specific assignment and usage
    if (customerId) {
      const customerCoupon = await this.couponRepository.findCustomerCoupon(
        coupon.id,
        customerId,
      );

      if (customerCoupon) {
        if (customerCoupon.status === 'used') {
          throw new BadRequestException('You have already used this coupon');
        }

        if (customerCoupon.status === 'cancelled') {
          throw new BadRequestException(
            'This coupon has been cancelled for your account',
          );
        }

        // Check per-customer usage limit
        if (
          coupon.usageLimitPerCustomer &&
          customerCoupon.usedCount >= coupon.usageLimitPerCustomer
        ) {
          throw new BadRequestException(
            'You have reached the usage limit for this coupon',
          );
        }
      }
    }

    // Calculate discount
    let discountAmount = 0;
    if (amount) {
      if (coupon.type === 'percentage') {
        discountAmount = (amount * parseFloat(coupon.value)) / 100;
        // Apply max discount cap if set
        if (
          coupon.maxDiscountAmount &&
          discountAmount > parseFloat(coupon.maxDiscountAmount)
        ) {
          discountAmount = parseFloat(coupon.maxDiscountAmount);
        }
      } else {
        discountAmount = parseFloat(coupon.value);
      }
    }

    return {
      valid: true,
      coupon,
      discountAmount,
      finalAmount: amount ? amount - discountAmount : undefined,
    };
  }

  // Apply coupon after booking
  async applyCoupon(
    storeId: string,
    couponId: string,
    customerId: string | null,
    appointmentId: string,
    discountAmount: number,
    originalAmount: number,
  ) {
    // Record usage
    await this.couponRepository.recordUsage(
      couponId,
      storeId,
      customerId,
      appointmentId,
      discountAmount,
      originalAmount,
    );

    // Increment coupon used count
    await this.couponRepository.incrementUsedCount(couponId);

    // Update customer coupon status if applicable
    if (customerId) {
      const customerCoupon = await this.couponRepository.findCustomerCoupon(
        couponId,
        customerId,
      );

      if (customerCoupon) {
        const coupon = await this.couponRepository.findById(couponId, storeId);
        const newUsedCount = customerCoupon.usedCount + 1;

        // Mark as used if reached per-customer limit
        if (
          coupon?.usageLimitPerCustomer &&
          newUsedCount >= coupon.usageLimitPerCustomer
        ) {
          await this.couponRepository.updateCustomerCouponStatus(
            couponId,
            customerId,
            'used',
          );
        } else {
          // Just increment the count
          await this.couponRepository.updateCustomerCouponStatus(
            couponId,
            customerId,
            'active',
          );
        }
      }
    }
  }
}
