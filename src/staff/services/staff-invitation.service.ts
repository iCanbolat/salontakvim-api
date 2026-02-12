import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'crypto';
import * as bcrypt from 'bcrypt';
import { StaffInvitationRepository } from '../repositories/staff-invitation.repository';
import { StaffMemberRepository } from '../repositories/staff-member.repository';
import { UserRepository } from '../../auth/repositories/user.repository';
import { LocationRepository } from '../../locations/repositories/location.repository';
import { StoreRepository } from '../../stores/repositories/store.repository';
import { ActivitiesService } from '../../activities/services/activities.service';
import { NotificationService } from '../../notifications/services/notification.service';
import { InviteStaffDto } from '../dto/invite-staff.dto';
import { AcceptInvitationDto } from '../dto/accept-invitation.dto';

@Injectable()
export class StaffInvitationService {
  constructor(
    private readonly staffInvitationRepository: StaffInvitationRepository,
    private readonly staffMemberRepository: StaffMemberRepository,
    private readonly userRepository: UserRepository,
    private readonly locationRepository: LocationRepository,
    private readonly storeRepository: StoreRepository,
    private readonly activitiesService: ActivitiesService,
    private readonly notificationService: NotificationService,
    private readonly configService: ConfigService,
  ) {}

  private buildInvitationLink(token: string) {
    const baseUrl =
      this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3000';

    return `${baseUrl.replace(/\/$/, '')}/invitations/accept?token=${token}`;
  }

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
      role: invitation.role,
      locationId: invitation.locationId ?? null,
      locationName,
      title: invitation.title ?? null,
      status: invitation.status,
      expiresAt: invitation.expiresAt,
    };
  }

  async inviteStaff(storeId: string, dto: InviteStaffDto, invitedBy: string) {
    const role = dto.role ?? 'staff';

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
      role,
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
      role,
      invitationLink: this.buildInvitationLink(invitationToken),
      locationName,
      title: dto.title ?? null,
    });

    await this.activitiesService.recordActivity(
      storeId,
      'staff',
      `Personel daveti gönderildi: ${dto.email}`,
      {
        invitationId: invitation.id,
        email: dto.email,
        invitedBy,
        locationId: dto.locationId || null,
      },
    );

    return invitation;
  }

  async getInvitations(storeId: string, locationId?: string) {
    const [invitations, locationMap] = await Promise.all([
      this.staffInvitationRepository.findByStoreId(storeId),
      this.locationRepository
        .findByStoreId(storeId)
        .then(
          (locations) =>
            new Map(locations.map((location) => [location.id, location.name])),
        ),
    ]);

    // Filter by locationId if provided (for manager role)
    const filteredInvitations = locationId
      ? invitations.filter((inv) => inv.locationId === locationId)
      : invitations;

    return filteredInvitations.map((invitation) => ({
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
        role: invitation.role,
      });
    } else {
      const updates: {
        firstName?: string;
        lastName?: string;
        phone?: string;
        password?: string;
        role?: 'admin' | 'manager' | 'staff' | 'customer';
      } = {};

      if (dto.firstName) updates.firstName = dto.firstName;
      if (dto.lastName) updates.lastName = dto.lastName;
      if (dto.phone) updates.phone = dto.phone;
      if (dto.password) updates.password = await bcrypt.hash(dto.password, 10);
      if (user.role !== invitation.role) updates.role = invitation.role;

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

    const staffFullName = [user.firstName, user.lastName]
      .filter(Boolean)
      .join(' ')
      .trim();

    await this.activitiesService.recordActivity(
      invitation.storeId,
      'staff',
      `Personel daveti kabul edildi: ${staffFullName || invitation.email}`,
      {
        staffId: staffMember.id,
        userId: user.id,
        email: invitation.email,
        staffName: staffFullName || invitation.email,
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

  async deleteInvitation(storeId: string, invitationId: string) {
    const invitation =
      await this.staffInvitationRepository.findById(invitationId);

    if (!invitation || invitation.storeId !== storeId) {
      throw new NotFoundException('Invitation not found');
    }

    await this.staffInvitationRepository.delete(invitationId);
  }
}
