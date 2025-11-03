import type { ServiceStaff } from '../interfaces/repository.interface';
import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import * as bcrypt from 'bcrypt';
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

@Injectable()
export class StaffService {
  constructor(
    private readonly staffMemberRepository: StaffMemberRepository,
    private readonly staffInvitationRepository: StaffInvitationRepository,
    private readonly staffWorkingHoursRepository: StaffWorkingHoursRepository,
    private readonly staffBreakRepository: StaffBreakRepository,
    private readonly serviceStaffRepository: ServiceStaffRepository,
    private readonly userRepository: UserRepository,
  ) {}

  // ============= Invitations =============

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
    });

    // TODO: Send invitation email with token
    // await this.emailService.sendStaffInvitation(dto.email, invitationToken);

    return invitation;
  }

  async getInvitations(storeId: number) {
    return await this.staffInvitationRepository.findByStoreId(storeId);
  }

  async acceptInvitation(token: string) {
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

    // Check if user exists
    let user = await this.userRepository.findByEmail(invitation.email);

    if (!user) {
      // Create new user account (password will be set by user)
      const temporaryPassword = randomBytes(16).toString('hex');
      const hashedPassword = await bcrypt.hash(temporaryPassword, 10);

      user = await this.userRepository.create({
        email: invitation.email,
        password: hashedPassword,
        role: 'staff',
      });
    }

    // Create staff member
    const staffMember = await this.staffMemberRepository.create({
      userId: user.id,
      storeId: invitation.storeId,
    });

    // Update invitation status
    await this.staffInvitationRepository.update(invitation.id, {
      status: 'accepted',
      acceptedAt: new Date(),
    });

    return staffMember;
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

  async getStaffMembers(storeId: number, includeHidden = false) {
    if (includeHidden) {
      return await this.staffMemberRepository.findByStoreId(storeId);
    }
    return await this.staffMemberRepository.findVisibleByStoreId(storeId);
  }

  async getStaffMember(storeId: number, staffId: number) {
    const staff = await this.staffMemberRepository.findByIdAndStoreId(
      staffId,
      storeId,
    );

    if (!staff) {
      throw new NotFoundException('Staff member not found');
    }

    return staff;
  }

  async updateStaffProfile(
    storeId: number,
    staffId: number,
    dto: UpdateStaffProfileDto,
  ) {
    const staff = await this.getStaffMember(storeId, staffId);
    return await this.staffMemberRepository.update(staff.id, dto);
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
    const assignments: ServiceStaff[] = [];
    for (const serviceId of dto.serviceIds) {
      const assignment = await this.serviceStaffRepository.assign({
        serviceId,
        staffId: staff.id,
      });
      assignments.push(assignment);
    }

    return assignments;
  }

  async getStaffServices(storeId: number, staffId: number) {
    const staff = await this.getStaffMember(storeId, staffId);
    return await this.serviceStaffRepository.findByStaffId(staff.id);
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

    if (overlappingBreaks.length > 0) {
      throw new ConflictException(
        'This break overlaps with an existing break or time off',
      );
    }

    return await this.staffBreakRepository.create({
      staffId: staff.id,
      ...dto,
    });
  }

  async getStaffBreaks(storeId: number, staffId: number) {
    const staff = await this.getStaffMember(storeId, staffId);
    return await this.staffBreakRepository.findByStaffId(staff.id);
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

      // Filter out the current break
      const conflicts = overlappingBreaks.filter((b) => b.id !== breakId);
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
