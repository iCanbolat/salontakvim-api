import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { StoreRepository } from '../repositories/store.repository';
import { StaffMemberRepository } from '../../staff/repositories/staff-member.repository';
import {
  CreateStoreDto,
  UpdateStoreDto,
  StoreResponseDto,
  UpdateCustomerDto,
} from '../dto';
import { plainToInstance } from 'class-transformer';
import { Store } from '../interfaces/repository.interface';
import type { JwtPayload } from '../../auth/interfaces/auth.interface';
import { SmsService } from '../../notifications/services/sms.service';
import { ActivitiesService } from '../../activities/services/activities.service';
import {
  StoreNotFoundException,
  StoreSlugAlreadyExistsException,
  UserAlreadyHasStoreException,
  UnauthorizedStoreAccessException,
} from '../exceptions';

const BULK_SMS_MAX_CUSTOMERS = 200;
const BULK_SMS_SEND_CHUNK_SIZE = 50;
const BULK_SMS_ACTIVITY_CHUNK_SIZE = 25;

@Injectable()
export class StoreService {
  constructor(
    private readonly storeRepository: StoreRepository,
    private readonly staffMemberRepository: StaffMemberRepository,
    private readonly smsService: SmsService,
    private readonly activitiesService: ActivitiesService,
  ) {}

  async create(
    ownerId: string,
    createStoreDto: CreateStoreDto,
  ): Promise<StoreResponseDto> {
    // Check if user already has a store
    const existingStore = await this.storeRepository.findByOwnerId(ownerId);
    if (existingStore) {
      throw new UserAlreadyHasStoreException(ownerId.toString());
    }

    // Check if slug is already taken
    const storeWithSlug = await this.storeRepository.findBySlug(
      createStoreDto.slug,
    );
    if (storeWithSlug) {
      throw new StoreSlugAlreadyExistsException(createStoreDto.slug);
    }

    const store = await this.storeRepository.create({
      name: createStoreDto.name,
      slug: createStoreDto.slug,
      description: createStoreDto.description,
      logo: createStoreDto.logo,
      email: createStoreDto.email,
      phone: createStoreDto.phone,
      country: (createStoreDto.country || 'TR').toUpperCase(),
      currency: (createStoreDto.currency || 'TRY').toUpperCase(),
      sendFeedbackViaSms: createStoreDto.sendFeedbackViaSms,
      ownerId,
    });

    // Optionally create staff profile for the owner
    if (createStoreDto.createStaffProfile) {
      await this.staffMemberRepository.create({
        userId: ownerId,
        storeId: store.id,
        title: createStoreDto.staffTitle || null,
        bio: createStoreDto.staffBio || null,
        isVisible:
          typeof createStoreDto.staffIsVisible === 'boolean'
            ? createStoreDto.staffIsVisible
            : true,
      });
    }

    return plainToInstance(StoreResponseDto, store, {
      excludeExtraneousValues: true,
    });
  }

  async findById(id: string, userId?: string): Promise<StoreResponseDto> {
    const store = await this.storeRepository.findById(id);
    if (!store) {
      throw new StoreNotFoundException(id.toString());
    }

    return plainToInstance(StoreResponseDto, store, {
      excludeExtraneousValues: true,
    });
  }

  async findBySlug(slug: string): Promise<StoreResponseDto> {
    const store = await this.storeRepository.findBySlug(slug);
    if (!store) {
      throw new StoreNotFoundException(slug);
    }

    return plainToInstance(StoreResponseDto, store, {
      excludeExtraneousValues: true,
    });
  }

  /**
   * Find store by owner ID without throwing error (for onboarding check)
   */
  async findByOwnerIdSafe(ownerId: string): Promise<Store | null> {
    return await this.storeRepository.findByOwnerId(ownerId);
  }

  async findMyStore(userId: string): Promise<StoreResponseDto> {
    // Owner account
    const storeByOwner = await this.storeRepository.findByOwnerId(userId);
    if (storeByOwner) {
      return plainToInstance(StoreResponseDto, storeByOwner, {
        excludeExtraneousValues: true,
      });
    }

    // Staff account
    const staffMembership =
      await this.staffMemberRepository.findByUserId(userId);

    if (staffMembership) {
      const store = await this.storeRepository.findById(
        staffMembership.storeId,
      );

      if (!store) {
        throw new StoreNotFoundException(staffMembership.storeId.toString());
      }

      return plainToInstance(StoreResponseDto, store, {
        excludeExtraneousValues: true,
      });
    }

    throw new StoreNotFoundException(userId.toString());
  }

  async update(
    id: string,
    userId: string,
    updateStoreDto: UpdateStoreDto,
  ): Promise<StoreResponseDto> {
    const store = await this.storeRepository.findById(id);
    if (!store) {
      throw new StoreNotFoundException(id.toString());
    }

    // Check if user is the owner
    if (store.ownerId !== userId) {
      throw new UnauthorizedStoreAccessException(
        id.toString(),
        userId.toString(),
      );
    }

    // If slug is being updated, check if it's available
    if (updateStoreDto.slug && updateStoreDto.slug !== store.slug) {
      const storeWithSlug = await this.storeRepository.findBySlug(
        updateStoreDto.slug,
      );
      if (storeWithSlug) {
        throw new StoreSlugAlreadyExistsException(updateStoreDto.slug);
      }
    }

    const updatedStore = await this.storeRepository.update(id, updateStoreDto);

    return plainToInstance(StoreResponseDto, updatedStore, {
      excludeExtraneousValues: true,
    });
  }

  async deactivate(id: string, userId: string): Promise<void> {
    const store = await this.storeRepository.findById(id);
    if (!store) {
      throw new StoreNotFoundException(id.toString());
    }

    // Check if user is the owner
    if (store.ownerId !== userId) {
      throw new UnauthorizedStoreAccessException(
        id.toString(),
        userId.toString(),
      );
    }

    await this.storeRepository.update(id, { isActive: false });
  }

  async delete(id: string, userId: string): Promise<void> {
    const store = await this.storeRepository.findById(id);
    if (!store) {
      throw new StoreNotFoundException(id.toString());
    }

    // Check if user is the owner
    if (store.ownerId !== userId) {
      throw new UnauthorizedStoreAccessException(
        id.toString(),
        userId.toString(),
      );
    }

    await this.storeRepository.delete(id);
  }

  async getAnalytics(
    id: string,
    userId: string,
  ): Promise<{
    totalAppointments: number;
    totalCustomers: number;
  }> {
    const store = await this.verifyStoreOwnership(id, userId);

    return {
      totalAppointments: store.totalAppointments || 0,
      totalCustomers: store.totalCustomers || 0,
    };
  }

  // Helper method to verify store access for owner OR staff membership
  async verifyStoreOwnership(storeId: string, userId: string): Promise<Store> {
    const store = await this.storeRepository.findById(storeId);
    if (!store) {
      throw new StoreNotFoundException(storeId.toString());
    }

    // Owners always allowed
    if (store.ownerId === userId) {
      return store;
    }

    // Staff: allow if user is a staff member of this store
    const staffMembership =
      await this.staffMemberRepository.findByUserId(userId);

    if (staffMembership && staffMembership.storeId === storeId) {
      return store;
    }

    throw new UnauthorizedStoreAccessException(storeId.toString(), userId);
  }

  // Helper method to check if store exists (for other modules)
  async validateStoreExists(storeId: string): Promise<Store> {
    const store = await this.storeRepository.findById(storeId);
    if (!store) {
      throw new StoreNotFoundException(storeId.toString());
    }
    return store;
  }

  // Customers endpoint - get unique customers from appointments
  async getCustomers(
    storeId: string,
    user: JwtPayload,
    options?: { search?: string; page?: number; limit?: number },
  ) {
    await this.verifyStoreOwnership(storeId, user.sub);

    const repositoryOptions = {
      page: options?.page,
      limit: options?.limit,
    };

    if (user.role === 'admin') {
      return this.storeRepository.getCustomers(
        storeId,
        options?.search,
        repositoryOptions,
      );
    }

    if (user.role === 'manager') {
      if (!user.locationId) {
        return { data: [], total: 0, page: 1, limit: 10, totalPages: 0 };
      }

      return this.storeRepository.getCustomers(storeId, options?.search, {
        locationId: user.locationId,
        ...repositoryOptions,
      });
    }

    if (user.role === 'staff') {
      const staffMember =
        await this.staffMemberRepository.findByUserIdAndStoreId(
          user.sub,
          storeId,
        );

      if (!staffMember) {
        return { data: [], total: 0, page: 1, limit: 10, totalPages: 0 };
      }

      return this.storeRepository.getCustomers(storeId, options?.search, {
        staffId: staffMember.id,
        ...repositoryOptions,
      });
    }

    return { data: [], total: 0, page: 1, limit: 10, totalPages: 0 };
  }

  // Get customer profile with stats
  async getCustomerProfile(
    storeId: string,
    customerId: string,
    user: JwtPayload,
  ) {
    await this.verifyStoreOwnership(storeId, user.sub);

    if (user.role === 'admin') {
      return this.storeRepository.getCustomerProfile(storeId, customerId);
    }

    if (user.role === 'manager') {
      if (!user.locationId) {
        return null;
      }

      return this.storeRepository.getCustomerProfile(storeId, customerId, {
        locationId: user.locationId,
      });
    }

    if (user.role === 'staff') {
      const staffMember =
        await this.staffMemberRepository.findByUserIdAndStoreId(
          user.sub,
          storeId,
        );

      if (!staffMember) {
        return null;
      }

      return this.storeRepository.getCustomerProfile(storeId, customerId, {
        staffId: staffMember.id,
      });
    }

    return null;
  }

  async updateCustomer(
    storeId: string,
    customerId: string,
    user: JwtPayload,
    updateCustomerDto: UpdateCustomerDto,
  ) {
    await this.verifyStoreOwnership(storeId, user.sub);

    let accessScope: { staffId?: string; locationId?: string } | undefined;

    if (user.role === 'manager') {
      if (!user.locationId) {
        throw new NotFoundException('Customer not found');
      }
      accessScope = { locationId: user.locationId };
    }

    if (user.role === 'staff') {
      const staffMember =
        await this.staffMemberRepository.findByUserIdAndStoreId(
          user.sub,
          storeId,
        );

      if (!staffMember) {
        throw new NotFoundException('Customer not found');
      }

      accessScope = { staffId: staffMember.id };
    }

    const existingProfile = await this.storeRepository.getCustomerProfile(
      storeId,
      customerId,
      accessScope,
    );

    if (!existingProfile) {
      throw new NotFoundException('Customer not found');
    }

    if (updateCustomerDto.generalNote !== undefined) {
      const normalizedGeneralNote =
        updateCustomerDto.generalNote.trim().length > 0
          ? updateCustomerDto.generalNote.trim()
          : null;

      await this.storeRepository.updateCustomerGeneralNote(
        storeId,
        customerId,
        normalizedGeneralNote,
      );
    }

    const updatedProfile = await this.storeRepository.getCustomerProfile(
      storeId,
      customerId,
      accessScope,
    );

    if (!updatedProfile) {
      throw new NotFoundException('Customer not found');
    }

    return updatedProfile.customer;
  }

  async sendBulkSms(
    storeId: string,
    user: JwtPayload,
    customerIds: string[],
    message: string,
  ) {
    const trimmedMessage = message.trim();
    if (!trimmedMessage) {
      throw new BadRequestException('Message is required');
    }

    if (trimmedMessage.length > 160) {
      throw new BadRequestException('Message cannot exceed 160 characters');
    }

    await this.verifyStoreOwnership(storeId, user.sub);

    const uniqueCustomerIds = Array.from(new Set(customerIds));
    if (uniqueCustomerIds.length === 0) {
      throw new BadRequestException('At least one customer must be selected');
    }

    if (uniqueCustomerIds.length > BULK_SMS_MAX_CUSTOMERS) {
      throw new BadRequestException(
        `You can send bulk SMS to at most ${BULK_SMS_MAX_CUSTOMERS} customers at once`,
      );
    }

    let customers: Array<{
      id: string;
      firstName: string | null;
      lastName: string | null;
      email: string | null;
      phone: string | null;
    }> = [];

    if (user.role === 'admin') {
      customers = await this.storeRepository.getCustomerContactsByIds(
        storeId,
        uniqueCustomerIds,
      );
    } else if (user.role === 'manager') {
      if (!user.locationId) {
        customers = [];
      } else {
        customers = await this.storeRepository.getCustomerContactsByIds(
          storeId,
          uniqueCustomerIds,
          { locationId: user.locationId },
        );
      }
    } else if (user.role === 'staff') {
      const staffMember =
        await this.staffMemberRepository.findByUserIdAndStoreId(
          user.sub,
          storeId,
        );

      if (!staffMember) {
        customers = [];
      } else {
        customers = await this.storeRepository.getCustomerContactsByIds(
          storeId,
          uniqueCustomerIds,
          { staffId: staffMember.id },
        );
      }
    }

    let sentCount = 0;
    let failedCount = 0;
    let noPhoneCount = 0;
    const invalidPhoneCustomerIds: string[] = [];
    const noPhoneCustomerIds: string[] = [];
    const deliverableCustomers: Array<{ id: string; phone: string }> = [];

    for (const customer of customers) {
      if (!customer.phone) {
        noPhoneCount += 1;
        noPhoneCustomerIds.push(customer.id);
        continue;
      }

      const formattedPhone = this.smsService.formatPhoneNumber(customer.phone);
      if (!this.smsService.isValidPhoneNumber(formattedPhone)) {
        failedCount += 1;
        invalidPhoneCustomerIds.push(customer.id);
        continue;
      }

      deliverableCustomers.push({
        id: customer.id,
        phone: formattedPhone,
      });
    }

    if (deliverableCustomers.length > 0) {
      for (const chunk of this.chunkArray(
        deliverableCustomers,
        BULK_SMS_SEND_CHUNK_SIZE,
      )) {
        const bulkResult = await this.smsService.sendBulkSMS({
          to: chunk.map((item) => item.phone),
          message: trimmedMessage,
        });

        sentCount += bulkResult.sent;
        failedCount += bulkResult.failed;
      }
    }

    const isSingleTarget = uniqueCustomerIds.length === 1;

    const activityTasks: Array<() => Promise<any>> = [];

    for (const customer of deliverableCustomers) {
      const activityMessage = isSingleTarget
        ? 'SMS sent to customer.'
        : 'SMS sent to customer via bulk campaign.';

      activityTasks.push(() =>
        this.activitiesService.recordActivity(
          storeId,
          'customer',
          activityMessage,
          {
            action: 'sms_sent',
            channel: 'sms',
            customerId: customer.id,
            senderUserId: user.sub,
            senderRole: user.role,
            isBulk: !isSingleTarget,
            requestedCount: uniqueCustomerIds.length,
            eligibleCount: customers.length,
            sentCount,
            failedCount,
            noPhoneCount,
            messageLength: trimmedMessage.length,
            preview: trimmedMessage.slice(0, 80),
          },
        ),
      );
    }

    for (const customerId of noPhoneCustomerIds) {
      const activityMessage = isSingleTarget
        ? 'SMS could not be sent to customer: phone number is missing.'
        : 'SMS could not be sent to customer via bulk campaign: phone number is missing.';

      activityTasks.push(() =>
        this.activitiesService.recordActivity(
          storeId,
          'customer',
          activityMessage,
          {
            action: 'sms_failed',
            reason: 'no_phone',
            channel: 'sms',
            customerId,
            senderUserId: user.sub,
            senderRole: user.role,
            isBulk: !isSingleTarget,
            requestedCount: uniqueCustomerIds.length,
            eligibleCount: customers.length,
            sentCount,
            failedCount,
            noPhoneCount,
            messageLength: trimmedMessage.length,
            preview: trimmedMessage.slice(0, 80),
          },
        ),
      );
    }

    for (const customerId of invalidPhoneCustomerIds) {
      const activityMessage = isSingleTarget
        ? 'SMS could not be sent to customer: phone number is invalid.'
        : 'SMS could not be sent to customer via bulk campaign: phone number is invalid.';

      activityTasks.push(() =>
        this.activitiesService.recordActivity(
          storeId,
          'customer',
          activityMessage,
          {
            action: 'sms_failed',
            reason: 'invalid_phone',
            channel: 'sms',
            customerId,
            senderUserId: user.sub,
            senderRole: user.role,
            isBulk: !isSingleTarget,
            requestedCount: uniqueCustomerIds.length,
            eligibleCount: customers.length,
            sentCount,
            failedCount,
            noPhoneCount,
            messageLength: trimmedMessage.length,
            preview: trimmedMessage.slice(0, 80),
          },
        ),
      );
    }

    for (const chunk of this.chunkArray(
      activityTasks,
      BULK_SMS_ACTIVITY_CHUNK_SIZE,
    )) {
      await Promise.all(chunk.map((task) => task()));
    }

    return {
      requested: uniqueCustomerIds.length,
      eligible: customers.length,
      sent: sentCount,
      failed: failedCount,
      noPhone: noPhoneCount,
      message: 'Bulk SMS operation completed',
    };
  }

  private chunkArray<T>(items: T[], chunkSize: number): T[][] {
    if (items.length === 0) {
      return [];
    }

    const safeChunkSize = Math.max(1, chunkSize);
    const chunks: T[][] = [];

    for (let index = 0; index < items.length; index += safeChunkSize) {
      chunks.push(items.slice(index, index + safeChunkSize));
    }

    return chunks;
  }
}
