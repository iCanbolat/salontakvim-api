import type { StaffMember } from '../interfaces/repository.interface';
import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'crypto';
import * as bcrypt from 'bcrypt';
import { plainToInstance } from 'class-transformer';
import { ServiceRepository } from '../../services/repositories/service.repository';
import { StaffMemberRepository } from '../repositories/staff-member.repository';
import { StaffInvitationRepository } from '../repositories/staff-invitation.repository';
import { StaffWorkingHoursRepository } from '../repositories/staff-working-hours.repository';
import { StaffBreakRepository } from '../repositories/staff-break.repository';
import { ServiceStaffRepository } from '../repositories/service-staff.repository';
import { UserRepository } from '../../auth/repositories/user.repository';
import { InviteStaffDto } from '../dto/invite-staff.dto';
import { UpdateStaffProfileDto } from '../dto/update-staff-profile.dto';
import { CreateWorkingHoursDto } from '../dto/create-working-hours.dto';
import { UpdateWorkingHoursDto } from '../dto/update-working-hours.dto';
import { CreateStaffBreakDto } from '../dto/create-staff-break.dto';
import { UpdateStaffBreakDto } from '../dto/update-staff-break.dto';
import { AssignServicesDto } from '../dto/assign-services.dto';
import { LocationRepository } from '../../locations/repositories/location.repository';
import { ServiceResponseDto } from '../../services/dto';
import { ActivitiesService } from '../../activities/services/activities.service';
import { NotificationService } from '../../notifications/services/notification.service';
import { StoreRepository } from '../../stores/repositories/store.repository';
import { AcceptInvitationDto } from '../dto/accept-invitation.dto';

@Injectable()
export class StaffService {
  constructor(
    private readonly staffMemberRepository: StaffMemberRepository,
    private readonly staffInvitationRepository: StaffInvitationRepository,
    private readonly staffWorkingHoursRepository: StaffWorkingHoursRepository,
    private readonly staffBreakRepository: StaffBreakRepository,
    private readonly serviceStaffRepository: ServiceStaffRepository,
    private readonly userRepository: UserRepository,
    private readonly locationRepository: LocationRepository,
    private readonly serviceRepository: ServiceRepository,
    private readonly activitiesService: ActivitiesService,
    private readonly storeRepository: StoreRepository,
    private readonly notificationService: NotificationService,
    private readonly configService: ConfigService,
  ) {}

  async getStaffByUserId(userId: number) {
    return await this.staffMemberRepository.findByUserId(userId);
  }

  private buildInvitationLink(token: string) {
    const baseUrl =
      this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3000';

    return `${baseUrl.replace(/\/$/, '')}/staff/invitations/accept?token=${token}`;
  }

  private filterByLocationId(staffList: StaffMember[], locationId?: number) {
    if (!locationId) {
      return staffList;
    }

    return staffList.filter((member) => member.locationId === locationId);
  }

  private async buildLocationNameMap(
    storeId: number,
  ): Promise<Map<number, string>> {
    const locations = await this.locationRepository.findByStoreId(storeId);
    return new Map(locations.map((location) => [location.id, location.name]));
  }

  private async buildUserMap(userIds: number[]) {
    const uniqueIds = Array.from(new Set(userIds.filter(Boolean)));
    if (!uniqueIds.length) {
      return new Map<number, any>();
    }
    const users = await this.userRepository.findByIds(uniqueIds);
    return new Map(users.map((user) => [user.id, user]));
  }

  private formatStaffResponse(
    staff: StaffMember,
    locationMap: Map<number, string>,
    userMap: Map<number, any>,
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
      fullName: fullName || null,
      locationName,
    };
  }

  private async hydrateStaffList(storeId: number, staff: StaffMember[]) {
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

  private async hydrateSingleStaff(storeId: number, staff: StaffMember) {
    const [locationMap, userMap] = await Promise.all([
      this.buildLocationNameMap(storeId),
      this.buildUserMap([staff.userId]),
    ]);

    return this.formatStaffResponse(staff, locationMap, userMap);
  }

  private async buildAssignedServicesResponse(staffId: number) {
    const services =
      await this.serviceStaffRepository.findServicesByStaffId(staffId);

    return plainToInstance(ServiceResponseDto, services, {
      excludeExtraneousValues: true,
    });
  }

  // ============= Invitations =============

  async getInvitationByToken(token: string) {
    const invitation = await this.staffInvitationRepository.findByToken(token);

    if (!invitation) {
      throw new NotFoundException('Invitation not found');
    }

    const now = new Date();
    if (invitation.status === 'pending' && now > invitation.expiresAt) {
      await this.staffInvitationRepository.update(invitation.id, {
        status: 'expired',
      });
      invitation.status = 'expired';
    }

    const store = await this.storeRepository.findById(invitation.storeId);

    let locationName: string | null = null;
    if (invitation.locationId) {
      const location = await this.locationRepository.findByIdAndStoreId(
        invitation.locationId,
        invitation.storeId,
      );
      locationName = location?.name ?? null;
    }

    return {
      id: invitation.id,
      email: invitation.email,
      storeId: invitation.storeId,
      storeName: store?.name ?? null,
      locationId: invitation.locationId ?? null,
      locationName,
      title: invitation.title ?? null,
      status: invitation.status,
      expiresAt: invitation.expiresAt,
    };
  }

  async inviteStaff(storeId: number, dto: InviteStaffDto, invitedBy: number) {
    // Check if user with email already exists
    const existingUser = await this.userRepository.findByEmail(dto.email);
    if (existingUser) {
      // Check if already staff member at this store
      const existingStaff =
        await this.staffMemberRepository.findByUserIdAndStoreId(
          existingUser.id,
          storeId,
        );
      if (existingStaff) {
        throw new ConflictException(
          'User is already a staff member at this store',
        );
      }
    }

    // Check for pending invitation
    const pendingInvitation =
      await this.staffInvitationRepository.findPendingByEmailAndStore(
        dto.email,
        storeId,
      );
    if (pendingInvitation) {
      throw new ConflictException(
        'An invitation has already been sent to this email',
      );
    }

    // Generate invitation token
    const invitationToken = randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiration

    const invitation = await this.staffInvitationRepository.create({
      storeId,
      email: dto.email,
      token: invitationToken,
      expiresAt,
      invitedBy,
      locationId: dto.locationId,
      title: dto.title,
    });

    const store = await this.storeRepository.findById(storeId);
    if (!store) {
      throw new NotFoundException('Store not found');
    }

    let locationName: string | null = null;
    if (dto.locationId) {
      const location = await this.locationRepository.findByIdAndStoreId(
        dto.locationId,
        storeId,
      );
      if (!location) {
        throw new NotFoundException('Location not found');
      }
      locationName = location.name;
    }

    const staffName = existingUser
      ? [existingUser.firstName, existingUser.lastName]
          .filter((part) => Boolean(part))
          .join(' ')
          .trim() || existingUser.email
      : dto.email;

    await this.notificationService.sendStaffInvitation(storeId, dto.email, {
      staffName,
      storeName: store.name,
      storeEmail: store.email || '',
      role: 'staff',
      invitationLink: this.buildInvitationLink(invitationToken),
      locationName,
      title: dto.title ?? null,
    });

    await this.activitiesService.recordActivity(
      storeId,
      'staff',
      'Personel daveti gönderildi',
      {
        invitationId: invitation.id,
        email: dto.email,
        invitedBy,
      },
    );

    return invitation;
  }

  async getInvitations(storeId: number) {
    const [invitations, locationMap] = await Promise.all([
      this.staffInvitationRepository.findByStoreId(storeId),
      this.buildLocationNameMap(storeId),
    ]);

    return invitations.map((invitation) => ({
      ...invitation,
      locationName:
        invitation.locationId != null
          ? (locationMap.get(invitation.locationId) ?? null)
          : null,
    }));
  }

  async acceptInvitation(token: string, dto: AcceptInvitationDto) {
    const invitation = await this.staffInvitationRepository.findByToken(token);

    if (!invitation) {
      throw new NotFoundException('Invitation not found');
    }

    if (invitation.status !== 'pending') {
      throw new BadRequestException('Invitation is no longer valid');
    }

    if (new Date() > invitation.expiresAt) {
      await this.staffInvitationRepository.update(invitation.id, {
        status: 'expired',
      });
      throw new BadRequestException('Invitation has expired');
    }

    const store = await this.storeRepository.findById(invitation.storeId);
    if (!store) {
      throw new NotFoundException('Store not found');
    }

    // Check if user exists
    let user = await this.userRepository.findByEmail(invitation.email);

    if (!user) {
      const hashedPassword = await bcrypt.hash(dto.password, 10);
      user = await this.userRepository.create({
        email: invitation.email,
        firstName: dto.firstName,
        lastName: dto.lastName,
        phone: dto.phone,
        password: hashedPassword,
        role: 'staff',
      });
    } else {
      const updates: {
        firstName?: string;
        lastName?: string;
        phone?: string;
        password?: string;
      } = {};

      if (dto.firstName) updates.firstName = dto.firstName;
      if (dto.lastName) updates.lastName = dto.lastName;
      if (dto.phone) updates.phone = dto.phone;
      if (dto.password) updates.password = await bcrypt.hash(dto.password, 10);

      if (Object.keys(updates).length) {
        user = await this.userRepository.update(user.id, updates);
      }
    }

    const existingStaff =
      await this.staffMemberRepository.findByUserIdAndStoreId(
        user.id,
        invitation.storeId,
      );

    if (existingStaff) {
      throw new ConflictException(
        'User is already a staff member at this store',
      );
    }

    let locationName: string | null = null;
    if (invitation.locationId) {
      const location = await this.locationRepository.findByIdAndStoreId(
        invitation.locationId,
        invitation.storeId,
      );

      if (!location) {
        throw new NotFoundException('Location not found');
      }

      locationName = location.name;
    }

    // Create staff member with location and title from invitation
    const staffMember = await this.staffMemberRepository.create({
      userId: user.id,
      storeId: invitation.storeId,
      locationId: invitation.locationId,
      title: invitation.title,
    });

    // Update invitation status
    await this.staffInvitationRepository.update(invitation.id, {
      status: 'accepted',
      acceptedAt: new Date(),
    });

    await this.activitiesService.recordActivity(
      invitation.storeId,
      'staff',
      'Yeni personel daveti kabul edildi',
      {
        staffId: staffMember.id,
        userId: user.id,
        email: invitation.email,
        locationId: invitation.locationId,
        title: invitation.title,
        locationName,
      },
    );

    return {
      staffMember,
      user,
      store,
      locationName,
    };
  }

  async deleteInvitation(storeId: number, invitationId: number) {
    const invitation =
      await this.staffInvitationRepository.findById(invitationId);

    if (!invitation || invitation.storeId !== storeId) {
      throw new NotFoundException('Invitation not found');
    }

    await this.staffInvitationRepository.delete(invitationId);
  }

  // ============= Staff Management =============

  async getStaffMembers(
    storeId: number,
    includeHidden = false,
    filters?: { serviceId?: number; locationId?: number },
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

    return await this.hydrateStaffList(storeId, filtered);
  }

  async getStaffMember(storeId: number, staffId: number) {
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
    storeId: number,
    staffId: number,
    dto: UpdateStaffProfileDto,
  ) {
    const staff = await this.getStaffMember(storeId, staffId);
    const updated = await this.staffMemberRepository.update(staff.id, dto);
    return await this.hydrateSingleStaff(storeId, updated);
  }

  async deleteStaffMember(storeId: number, staffId: number) {
    const staff = await this.getStaffMember(storeId, staffId);

    // Delete all related data
    await this.serviceStaffRepository.unassignAllFromStaff(staff.id);
    await this.staffMemberRepository.delete(staff.id);
  }

  // ============= Service Assignments =============

  async assignServices(
    storeId: number,
    staffId: number,
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

  async getStaffServices(storeId: number, staffId: number) {
    const staff = await this.getStaffMember(storeId, staffId);
    return await this.buildAssignedServicesResponse(staff.id);
  }

  async removeServiceFromStaff(
    storeId: number,
    staffId: number,
    serviceId: number,
  ) {
    const staff = await this.getStaffMember(storeId, staffId);
    await this.serviceStaffRepository.unassign(serviceId, staff.id);
  }

  // ============= Working Hours =============

  async createWorkingHours(
    storeId: number,
    staffId: number,
    dto: CreateWorkingHoursDto,
  ) {
    const staff = await this.getStaffMember(storeId, staffId);

    return await this.staffWorkingHoursRepository.create({
      staffId: staff.id,
      ...dto,
    });
  }

  async getWorkingHours(storeId: number, staffId: number) {
    const staff = await this.getStaffMember(storeId, staffId);
    return await this.staffWorkingHoursRepository.findByStaffId(staff.id);
  }

  async updateWorkingHours(
    storeId: number,
    staffId: number,
    workingHoursId: number,
    dto: UpdateWorkingHoursDto,
  ) {
    const staff = await this.getStaffMember(storeId, staffId);

    const workingHours =
      await this.staffWorkingHoursRepository.findByIdAndStaffId(
        workingHoursId,
        staff.id,
      );

    if (!workingHours) {
      throw new NotFoundException('Working hours not found');
    }

    return await this.staffWorkingHoursRepository.update(workingHoursId, dto);
  }

  async deleteWorkingHours(
    storeId: number,
    staffId: number,
    workingHoursId: number,
  ) {
    const staff = await this.getStaffMember(storeId, staffId);

    const workingHours =
      await this.staffWorkingHoursRepository.findByIdAndStaffId(
        workingHoursId,
        staff.id,
      );

    if (!workingHours) {
      throw new NotFoundException('Working hours not found');
    }

    await this.staffWorkingHoursRepository.delete(workingHoursId);
  }

  // ============= Breaks & Time Off =============

  async createStaffBreak(
    storeId: number,
    staffId: number,
    dto: CreateStaffBreakDto,
  ) {
    const staff = await this.getStaffMember(storeId, staffId);

    // Validate date range
    if (dto.endDate < dto.startDate) {
      throw new BadRequestException('End date must be after start date');
    }

    // Check for overlapping breaks
    const overlappingBreaks =
      await this.staffBreakRepository.findByStaffIdAndDateRange(
        staff.id,
        dto.startDate,
        dto.endDate,
      );

    // Filter out declined requests
    const activeOverlaps = overlappingBreaks.filter(
      (b) => b.status !== 'declined',
    );

    if (activeOverlaps.length > 0) {
      throw new ConflictException(
        'This break overlaps with an existing break or time off',
      );
    }

    const createdBreak = await this.staffBreakRepository.create({
      staffId: staff.id,
      ...dto,
    });

    await this.activitiesService.recordActivity(
      storeId,
      'staff',
      'Personel zaman izni eklendi',
      {
        staffId: staff.id,
        breakId: createdBreak.id,
        startDate: dto.startDate,
        endDate: dto.endDate,
        startTime: dto.startTime,
        endTime: dto.endTime,
      },
    );

    return createdBreak;
  }

  async getStaffBreaks(storeId: number, staffId: number) {
    const staff = await this.getStaffMember(storeId, staffId);
    return await this.staffBreakRepository.findByStaffId(staff.id);
  }

  async getStaffBreak(storeId: number, staffId: number, breakId: number) {
    const staff = await this.getStaffMember(storeId, staffId);
    const staffBreak = await this.staffBreakRepository.findByIdAndStaffId(
      breakId,
      staff.id,
    );
    if (!staffBreak) {
      throw new NotFoundException('Break not found');
    }
    return staffBreak;
  }

  async updateStaffBreak(
    storeId: number,
    staffId: number,
    breakId: number,
    dto: UpdateStaffBreakDto,
  ) {
    const staff = await this.getStaffMember(storeId, staffId);

    const staffBreak = await this.staffBreakRepository.findByIdAndStaffId(
      breakId,
      staff.id,
    );

    if (!staffBreak) {
      throw new NotFoundException('Break not found');
    }

    // If dates are being updated, check for overlaps
    if (dto.startDate || dto.endDate) {
      const startDate = dto.startDate || staffBreak.startDate;
      const endDate = dto.endDate || staffBreak.endDate;

      if (endDate < startDate) {
        throw new BadRequestException('End date must be after start date');
      }

      const overlappingBreaks =
        await this.staffBreakRepository.findByStaffIdAndDateRange(
          staff.id,
          startDate,
          endDate,
        );

      // Filter out the current break and declined breaks
      const conflicts = overlappingBreaks.filter(
        (b) => b.id !== breakId && b.status !== 'declined',
      );
      if (conflicts.length > 0) {
        throw new ConflictException(
          'This break overlaps with an existing break or time off',
        );
      }
    }

    return await this.staffBreakRepository.update(breakId, dto);
  }

  async deleteStaffBreak(storeId: number, staffId: number, breakId: number) {
    const staff = await this.getStaffMember(storeId, staffId);

    const staffBreak = await this.staffBreakRepository.findByIdAndStaffId(
      breakId,
      staff.id,
    );

    if (!staffBreak) {
      throw new NotFoundException('Break not found');
    }

    await this.staffBreakRepository.delete(breakId);
  }
}
