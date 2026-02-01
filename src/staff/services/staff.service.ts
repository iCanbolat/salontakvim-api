import type { StaffMember } from '../interfaces/repository.interface';
import { randomUUID } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { ServiceRepository } from '../../services/repositories/service.repository';
import { StaffMemberRepository } from '../repositories/staff-member.repository';
import { ServiceStaffRepository } from '../repositories/service-staff.repository';
import { UserRepository } from '../../auth/repositories/user.repository';
import { UpdateStaffProfileDto } from '../dto/update-staff-profile.dto';
import { AssignServicesDto } from '../dto/assign-services.dto';
import { LocationRepository } from '../../locations/repositories/location.repository';
import { ServiceResponseDto } from '../../services/dto';
import { ConfigService } from '@nestjs/config';
import type { Express } from 'express';
import { ActivitiesService } from '../../activities/services/activities.service';
import { FileUploadService } from '../../common/file-upload';

@Injectable()
export class StaffService {
  constructor(
    private readonly staffMemberRepository: StaffMemberRepository,
    private readonly serviceStaffRepository: ServiceStaffRepository,
    private readonly userRepository: UserRepository,
    private readonly locationRepository: LocationRepository,
    private readonly serviceRepository: ServiceRepository,
    private readonly configService: ConfigService,
    private readonly activitiesService: ActivitiesService,
    private readonly fileUploadService: FileUploadService,
  ) {}

  private filterByLocationId(staffList: StaffMember[], locationId?: string) {
    if (!locationId) {
      return staffList;
    }

    return staffList.filter((member) => member.locationId === locationId);
  }

  private async buildLocationNameMap(
    storeId: string,
  ): Promise<Map<string, string>> {
    const locations = await this.locationRepository.findByStoreId(storeId);
    return new Map(locations.map((location) => [location.id, location.name]));
  }

  private async buildUserMap(userIds: string[]) {
    const uniqueIds = Array.from(new Set(userIds.filter(Boolean)));
    if (!uniqueIds.length) {
      return new Map<string, any>();
    }
    const users = await this.userRepository.findByIds(uniqueIds);
    return new Map(users.map((user) => [user.id, user]));
  }

  private formatStaffResponse(
    staff: StaffMember,
    locationMap: Map<string, string>,
    userMap: Map<string, any>,
  ) {
    const user = userMap.get(staff.userId);
    const fullName = [user?.firstName, user?.lastName]
      .filter((part) => Boolean(part))
      .join(' ')
      .trim();

    const locationName =
      staff.locationId != null
        ? (locationMap.get(staff.locationId) ?? null)
        : null;

    return {
      ...staff,
      email: user?.email ?? null,
      firstName: user?.firstName ?? null,
      lastName: user?.lastName ?? null,
      avatar: user?.avatar ?? null,
      role: user?.role ?? null,
      fullName: fullName || null,
      locationName,
    };
  }

  private async hydrateStaffList(storeId: string, staff: StaffMember[]) {
    if (!staff.length) {
      return [];
    }

    const [locationMap, userMap] = await Promise.all([
      this.buildLocationNameMap(storeId),
      this.buildUserMap(staff.map((member) => member.userId)),
    ]);

    return staff.map((member) =>
      this.formatStaffResponse(member, locationMap, userMap),
    );
  }

  private async hydrateSingleStaff(storeId: string, staff: StaffMember) {
    const [locationMap, userMap] = await Promise.all([
      this.buildLocationNameMap(storeId),
      this.buildUserMap([staff.userId]),
    ]);

    return this.formatStaffResponse(staff, locationMap, userMap);
  }

  private async buildAssignedServicesResponse(staffId: string) {
    const services =
      await this.serviceStaffRepository.findServicesByStaffId(staffId);

    return plainToInstance(ServiceResponseDto, services, {
      excludeExtraneousValues: true,
    });
  }

  // ============= Staff Management =============

  async getStaffMembers(
    storeId: string,
    includeHidden = false,
    filters?: { serviceId?: string; locationId?: string; search?: string },
  ) {
    const staffList = includeHidden
      ? await this.staffMemberRepository.findByStoreId(storeId)
      : await this.staffMemberRepository.findVisibleByStoreId(storeId);

    let filtered = this.filterByLocationId(staffList, filters?.locationId);

    if (filters?.serviceId) {
      const service = await this.serviceRepository.findByIdAndStoreId(
        filters.serviceId,
        storeId,
      );
      if (!service) {
        throw new NotFoundException('Service not found');
      }

      const assignments = await this.serviceStaffRepository.findByServiceId(
        filters.serviceId,
      );
      const allowedStaffIds = new Set(assignments.map((a) => a.staffId));
      filtered = filtered.filter((member) => allowedStaffIds.has(member.id));
    }

    const hydrated = await this.hydrateStaffList(storeId, filtered);

    const searchTerm = filters?.search?.trim().toLowerCase();
    if (!searchTerm) {
      return hydrated;
    }

    return hydrated.filter((member) => {
      const haystacks = [
        member.fullName,
        member.email,
        member.title,
        member.locationName,
      ]
        .filter((value): value is string => Boolean(value))
        .map((value) => value.toLowerCase());

      return haystacks.some((value) => value.includes(searchTerm));
    });
  }

  async getStaffMember(storeId: string, staffId: string) {
    const staff = await this.staffMemberRepository.findByIdAndStoreId(
      staffId,
      storeId,
    );

    if (!staff) {
      throw new NotFoundException('Staff member not found');
    }

    return await this.hydrateSingleStaff(storeId, staff);
  }

  async updateStaffProfile(
    storeId: string,
    staffId: string,
    dto: UpdateStaffProfileDto,
  ) {
    const staff = await this.getStaffMember(storeId, staffId);
    const { role, ...profileData } = dto;

    const updated = await this.staffMemberRepository.update(
      staff.id,
      profileData,
    );

    if (role) {
      const user = await this.userRepository.findById(staff.userId);
      if (!user) {
        throw new NotFoundException('User not found for staff member');
      }

      if (user.role !== role) {
        await this.userRepository.update(staff.userId, { role });

        const staffName = [user.firstName, user.lastName]
          .filter((part) => Boolean(part))
          .join(' ')
          .trim();

        if (role === 'admin') {
          await this.activitiesService.recordActivity(
            storeId,
            'staff',
            `Personel yönetici yetkisi verildi: ${staffName || user.email}`,
            {
              staffId: staff.id,
              userId: user.id,
              staffName: staffName || user.email,
              previousRole: user.role,
              newRole: role,
            },
          );
        } else if (user.role === 'admin') {
          await this.activitiesService.recordActivity(
            storeId,
            'staff',
            `Personel yönetici yetkisi kaldırıldı: ${staffName || user.email}`,
            {
              staffId: staff.id,
              userId: user.id,
              staffName: staffName || user.email,
              previousRole: user.role,
              newRole: role,
            },
          );
        }
      }
    }

    return await this.hydrateSingleStaff(storeId, updated);
  }

  async uploadStaffAvatar(
    storeId: string,
    staffId: string,
    file: Express.Multer.File,
  ) {
    const staff = await this.staffMemberRepository.findByIdAndStoreId(
      staffId,
      storeId,
    );

    if (!staff) {
      throw new NotFoundException('Staff member not found');
    }

    const user = await this.userRepository.findById(staff.userId);
    if (!user) {
      throw new NotFoundException('User not found for staff member');
    }

    // Delete existing avatar if exists
    if (user.avatar?.includes(`/stores/${storeId}/avatars/`)) {
      const existingName = path.basename(user.avatar);
      this.fileUploadService.deleteFileByPath(storeId, 'avatars', existingName);
    }

    // Save new avatar using common file upload service
    const result = this.fileUploadService.saveFile(
      file,
      storeId,
      'avatars',
      undefined,
      `${staff.userId}-${randomUUID()}`,
    );

    await this.userRepository.update(staff.userId, { avatar: result.fileUrl });

    return { avatarUrl: result.fileUrl };
  }

  async getAvatarFile(storeId: string, fileName: string) {
    const fileInfo = this.fileUploadService.getFileInfo(
      storeId,
      'avatars',
      fileName,
    );

    if (!fileInfo) {
      throw new NotFoundException('Avatar file not found');
    }

    return fileInfo;
  }

  async createSelfStaffProfile(
    storeId: string,
    userId: string,
    dto: UpdateStaffProfileDto,
  ) {
    const existing = await this.staffMemberRepository.findByUserIdAndStoreId(
      userId,
      storeId,
    );

    if (existing) {
      return await this.hydrateSingleStaff(storeId, existing);
    }

    const created = await this.staffMemberRepository.create({
      storeId,
      userId,
      title: dto.title ?? null,
      bio: dto.bio ?? null,
      locationId: dto.locationId ?? null,
      isVisible: typeof dto.isVisible === 'boolean' ? dto.isVisible : true,
    });

    return await this.hydrateSingleStaff(storeId, created);
  }

  async deleteStaffMember(storeId: string, staffId: string) {
    const staff = await this.getStaffMember(storeId, staffId);

    // Delete all related data
    await this.serviceStaffRepository.unassignAllFromStaff(staff.id);
    await this.staffMemberRepository.delete(staff.id);
  }

  // ============= Service Assignments =============

  async assignServices(
    storeId: string,
    staffId: string,
    dto: AssignServicesDto,
  ) {
    const staff = await this.getStaffMember(storeId, staffId);

    // TODO: Validate that all services belong to the store
    // This would require ServiceRepository to be injected

    // Remove existing assignments
    await this.serviceStaffRepository.unassignAllFromStaff(staff.id);

    // Create new assignments
    const serviceIds = dto.serviceIds ?? [];

    if (!serviceIds.length) {
      return [];
    }

    await Promise.all(
      serviceIds.map((serviceId) =>
        this.serviceStaffRepository.assign({
          serviceId,
          staffId: staff.id,
        }),
      ),
    );

    return await this.buildAssignedServicesResponse(staff.id);
  }

  async getStaffServices(storeId: string, staffId: string) {
    const staff = await this.getStaffMember(storeId, staffId);
    return await this.buildAssignedServicesResponse(staff.id);
  }

  async removeServiceFromStaff(
    storeId: string,
    staffId: string,
    serviceId: string,
  ) {
    const staff = await this.getStaffMember(storeId, staffId);
    await this.serviceStaffRepository.unassign(serviceId, staff.id);
  }
}
