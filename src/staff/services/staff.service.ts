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

@Injectable()
export class StaffService {
  constructor(
    private readonly staffMemberRepository: StaffMemberRepository,
    private readonly serviceStaffRepository: ServiceStaffRepository,
    private readonly userRepository: UserRepository,
    private readonly locationRepository: LocationRepository,
    private readonly serviceRepository: ServiceRepository,
    private readonly configService: ConfigService,
  ) {}

  private readonly maxAvatarSize = 5 * 1024 * 1024;

  private get uploadDir() {
    return this.configService.get<string>('UPLOAD_DIR') || './uploads';
  }

  private get baseUrl() {
    return this.configService.get<string>('APP_URL') || 'http://localhost:8080';
  }

  private get apiPrefix() {
    return this.configService.get<string>('API_PREFIX') || 'api';
  }

  private ensureAvatarDir(storeId: string) {
    const dir = path.join(this.uploadDir, storeId, 'avatars');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    return dir;
  }

  private buildAvatarUrl(storeId: string, fileName: string) {
    const normalizedBase = this.baseUrl.replace(/\/+$/, '');
    const prefixSegment = this.apiPrefix.replace(/^\/+|\/+$/g, '');
    const hasPrefixAlready =
      prefixSegment.length > 0 && normalizedBase.endsWith(`/${prefixSegment}`);
    const prefix =
      prefixSegment.length > 0 && !hasPrefixAlready ? `/${prefixSegment}` : '';

    return `${normalizedBase}${prefix}/stores/${storeId}/avatars/${encodeURIComponent(fileName)}`;
  }

  private validateAvatarFile(file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    if (!file.mimetype.startsWith('image/')) {
      throw new BadRequestException('Only image files are allowed');
    }

    if (file.size > this.maxAvatarSize) {
      throw new BadRequestException('Avatar file size exceeds 5MB');
    }
  }

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

    this.validateAvatarFile(file);

    const user = await this.userRepository.findById(staff.userId);
    if (!user) {
      throw new NotFoundException('User not found for staff member');
    }

    const avatarDir = this.ensureAvatarDir(storeId);
    const fileExt = path.extname(file.originalname) || '.png';
    const fileName = `${staff.userId}-${randomUUID()}${fileExt}`;
    const storagePath = path.join(avatarDir, fileName);

    if (user.avatar?.includes(`/stores/${storeId}/avatars/`)) {
      const existingName = path.basename(user.avatar);
      const existingPath = path.join(avatarDir, existingName);
      if (fs.existsSync(existingPath)) {
        fs.unlinkSync(existingPath);
      }
    }

    fs.writeFileSync(storagePath, file.buffer);

    const avatarUrl = this.buildAvatarUrl(storeId, fileName);
    await this.userRepository.update(staff.userId, { avatar: avatarUrl });

    return { avatarUrl };
  }

  async getAvatarFile(storeId: string, fileName: string) {
    const safeName = path.basename(fileName);
    const filePath = path.join(this.uploadDir, storeId, 'avatars', safeName);

    if (!fs.existsSync(filePath)) {
      throw new NotFoundException('Avatar file not found');
    }

    const ext = path.extname(safeName).toLowerCase();
    const mimeType =
      ext === '.png'
        ? 'image/png'
        : ext === '.jpg' || ext === '.jpeg'
          ? 'image/jpeg'
          : ext === '.gif'
            ? 'image/gif'
            : ext === '.webp'
              ? 'image/webp'
              : 'application/octet-stream';

    return { path: filePath, mimeType, fileName: safeName };
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
