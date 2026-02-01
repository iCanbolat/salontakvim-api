import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { FeedbackRepository } from '../repositories/feedback.repository';
import { StoreRepository } from '../../stores/repositories/store.repository';
import { AppointmentRepository } from '../../appointments/repositories/appointment.repository';
import { StaffMemberRepository } from '../../staff/repositories/staff-member.repository';
import { ActivitiesService } from '../../activities/services/activities.service';
import { UserRepository } from '../../auth/repositories/user.repository';
import type {
  CreateFeedbackDto,
  UpdateFeedbackDto,
  FeedbackResponseDto,
  FeedbackWithDetailsDto,
  FeedbackStatsDto,
} from '../dto';

type PaginatedFeedbackResult = {
  data: FeedbackWithDetailsDto[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

@Injectable()
export class FeedbackService {
  constructor(
    private readonly feedbackRepository: FeedbackRepository,
    private readonly storeRepository: StoreRepository,
    private readonly appointmentRepository: AppointmentRepository,
    private readonly staffMemberRepository: StaffMemberRepository,
    private readonly activitiesService: ActivitiesService,
    private readonly userRepository: UserRepository,
  ) {}

  private async getCustomerName(appointment: any): Promise<string> {
    if (appointment.customerId) {
      const user = await this.userRepository.findById(appointment.customerId);
      if (user) {
        return (
          `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Müşteri'
        );
      }
    }

    const guestName =
      `${appointment.guestFirstName || ''} ${appointment.guestLastName || ''}`.trim();
    return guestName || 'Misafir Müşteri';
  }

  private async validateStoreAccess(storeId: string, userId: string) {
    const store = await this.storeRepository.findById(storeId);
    if (!store) {
      throw new NotFoundException('Store not found');
    }
    const isOwner = store.ownerId === userId;
    const staff = await this.staffMemberRepository.findByUserId(userId);
    const isStaff = staff?.storeId === storeId;

    if (!isOwner && !isStaff) {
      throw new BadRequestException('You do not have access to this store');
    }

    return { store, isOwner, staff };
  }

  async create(
    storeId: string,
    dto: CreateFeedbackDto,
    userId?: string,
  ): Promise<FeedbackResponseDto> {
    // Check if appointment exists and belongs to store
    const appointment = await this.appointmentRepository.findById(
      dto.appointmentId,
    );

    if (!appointment) {
      throw new NotFoundException('Appointment not found');
    }

    if (appointment.storeId !== storeId) {
      throw new BadRequestException(
        'Appointment does not belong to this store',
      );
    }

    // Only allow feedback for completed appointments
    if (appointment.status !== 'completed') {
      throw new BadRequestException(
        'Feedback can only be submitted for completed appointments',
      );
    }

    // Check if feedback already exists
    const existingFeedback = await this.feedbackRepository.findByAppointmentId(
      dto.appointmentId,
    );
    if (existingFeedback) {
      throw new ConflictException(
        'Feedback has already been submitted for this appointment',
      );
    }

    // If userId is provided, verify it matches the customer
    if (userId && appointment.customerId && userId !== appointment.customerId) {
      throw new ForbiddenException(
        'You can only submit feedback for your own appointments',
      );
    }

    const feedback = await this.feedbackRepository.create(storeId, dto, {
      customerId: appointment.customerId,
      staffId: appointment.staffId,
      serviceId: appointment.serviceId,
    });

    const customerName = await this.getCustomerName(appointment);

    // Record activity
    await this.activitiesService.recordActivity(
      storeId,
      'appointment',
      `${customerName} değerlendirmesi alındı: ${dto.overallRating} yıldız`,
      {
        feedbackId: feedback.id,
        appointmentId: appointment.id,
        rating: dto.overallRating,
      },
    );

    return feedback as FeedbackResponseDto;
  }

  async findById(
    storeId: string,
    feedbackId: string,
    userId: string,
  ): Promise<FeedbackWithDetailsDto> {
    await this.validateStoreAccess(storeId, userId);

    const result = await this.feedbackRepository.findWithDetails(
      feedbackId,
      storeId,
    );

    if (!result) {
      throw new NotFoundException('Feedback not found');
    }

    return {
      ...result.feedback,
      customer: result.customer,
      staff: result.staff,
      service: result.service,
    } as FeedbackWithDetailsDto;
  }

  async findAll(
    storeId: string,
    userId: string,
    options?: {
      customerId?: string;
      staffId?: string;
      serviceId?: string;
      search?: string;
      page?: number;
      limit?: number;
    },
  ): Promise<PaginatedFeedbackResult> {
    const { isOwner, staff } = await this.validateStoreAccess(storeId, userId);

    // If not owner, only allow viewing their own feedback
    const finalFilters = { ...options };
    if (!isOwner && staff) {
      finalFilters.staffId = staff.id;
    }

    const result = await this.feedbackRepository.findAllPaginated(
      storeId,
      finalFilters,
    );

    const data = result.data.map(({ feedback, customer, staff, service }) => ({
      ...feedback,
      customer,
      staff,
      service,
    })) as FeedbackWithDetailsDto[];

    return {
      ...result,
      data,
    };
  }

  async findByAppointmentId(
    storeId: string,
    appointmentId: string,
    userId: string,
  ): Promise<FeedbackWithDetailsDto | null> {
    await this.validateStoreAccess(storeId, userId);

    const result = await this.feedbackRepository.findByAppointmentIdWithDetails(
      appointmentId,
      storeId,
    );

    if (!result) {
      return null;
    }

    return {
      ...result.feedback,
      customer: result.customer,
    } as FeedbackWithDetailsDto;
  }

  async getPublicFeedback(
    storeId: string,
    options?: {
      staffId?: string;
      serviceId?: string;
      limit?: number;
      offset?: number;
    },
  ): Promise<FeedbackWithDetailsDto[]> {
    const results = await this.feedbackRepository.findAll(storeId, {
      ...options,
    });

    return results.map(({ feedback, customer }) => ({
      ...feedback,
      customer: customer
        ? {
            id: customer.id,
            firstName: customer.firstName,
            avatar: customer.avatar,
            lastName: null, // Hide last name for public display
          }
        : undefined,
    })) as FeedbackWithDetailsDto[];
  }

  async update(
    storeId: string,
    feedbackId: string,
    userId: string,
    dto: UpdateFeedbackDto,
  ): Promise<FeedbackResponseDto> {
    const feedback = await this.feedbackRepository.findById(
      feedbackId,
      storeId,
    );

    if (!feedback) {
      throw new NotFoundException('Feedback not found');
    }

    // Only customer can update their own feedback
    if (feedback.customerId !== userId) {
      throw new ForbiddenException('You can only update your own feedback');
    }

    const updated = await this.feedbackRepository.update(feedbackId, storeId, {
      comment: dto.comment,
    });

    return updated as FeedbackResponseDto;
  }

  async delete(
    storeId: string,
    feedbackId: string,
    userId: string,
  ): Promise<void> {
    const { isOwner } = await this.validateStoreAccess(storeId, userId);

    const feedback = await this.feedbackRepository.findById(
      feedbackId,
      storeId,
    );

    if (!feedback) {
      throw new NotFoundException('Feedback not found');
    }

    // Only store owner or the customer who wrote it can delete
    if (!isOwner && feedback.customerId !== userId) {
      throw new ForbiddenException(
        'You do not have permission to delete this feedback',
      );
    }

    await this.feedbackRepository.delete(feedbackId, storeId);
  }

  async getStats(
    storeId: string,
    userId: string,
    staffId?: string,
    serviceId?: string,
  ): Promise<FeedbackStatsDto> {
    const { isOwner, staff } = await this.validateStoreAccess(storeId, userId);

    let finalStaffId = staffId;
    if (!isOwner && staff) {
      finalStaffId = staff.id;
    }

    return this.feedbackRepository.getStats(storeId, finalStaffId, serviceId);
  }

  async getPublicStats(storeId: string): Promise<FeedbackStatsDto> {
    return this.feedbackRepository.getStats(storeId);
  }

  async getStaffRating(staffId: string) {
    return this.feedbackRepository.getStaffAverageRating(staffId);
  }

  async getServiceRating(serviceId: string) {
    return this.feedbackRepository.getServiceAverageRating(serviceId);
  }

  /**
   * Public feedback submission - no auth required
   * Validates appointment exists, is completed, token is valid, and no feedback exists yet
   */
  async createPublic(
    storeId: string,
    dto: CreateFeedbackDto & { token?: string },
  ): Promise<FeedbackResponseDto> {
    const appointment = await this.appointmentRepository.findById(
      dto.appointmentId,
    );

    if (!appointment) {
      throw new NotFoundException('Appointment not found');
    }

    if (appointment.storeId !== storeId) {
      throw new BadRequestException(
        'Appointment does not belong to this store',
      );
    }

    if (appointment.status !== 'completed') {
      throw new BadRequestException(
        'Feedback can only be submitted for completed appointments',
      );
    }

    // Validate feedback token
    if (!dto.token || appointment.feedbackToken !== dto.token) {
      throw new BadRequestException('Invalid or missing feedback token');
    }

    // Check if token has expired
    if (
      appointment.feedbackTokenExpiresAt &&
      new Date() > new Date(appointment.feedbackTokenExpiresAt)
    ) {
      throw new BadRequestException(
        'Feedback link has expired. Please contact the store for a new link.',
      );
    }

    const existingFeedback = await this.feedbackRepository.findByAppointmentId(
      dto.appointmentId,
    );
    if (existingFeedback) {
      throw new ConflictException(
        'Feedback has already been submitted for this appointment',
      );
    }

    const feedback = await this.feedbackRepository.create(storeId, dto, {
      customerId: appointment.customerId,
      staffId: appointment.staffId,
      serviceId: appointment.serviceId,
    });

    // Invalidate the token after successful submission
    await this.appointmentRepository.update(appointment.id, {
      feedbackToken: null,
      feedbackTokenExpiresAt: null,
    });

    const customerName = await this.getCustomerName(appointment);

    // Record activity
    await this.activitiesService.recordActivity(
      storeId,
      'appointment',
      `${customerName} değerlendirmesi alındı: ${dto.overallRating} yıldız`,
      {
        feedbackId: feedback.id,
        appointmentId: appointment.id,
        rating: dto.overallRating,
      },
    );

    return feedback as FeedbackResponseDto;
  }

  /**
   * Check if feedback can be submitted for an appointment
   */
  async checkFeedbackStatus(
    storeId: string,
    appointmentId: string,
    token?: string,
  ): Promise<{
    canSubmit: boolean;
    reason?: string;
    appointmentDetails?: {
      serviceName?: string;
      staffName?: string;
      appointmentDate?: string;
      storeName?: string;
    };
  }> {
    const appointment =
      await this.appointmentRepository.findById(appointmentId);

    if (!appointment) {
      return { canSubmit: false, reason: 'Appointment not found' };
    }

    if (appointment.storeId !== storeId) {
      return {
        canSubmit: false,
        reason: 'Appointment does not belong to this store',
      };
    }

    if (appointment.status !== 'completed') {
      return { canSubmit: false, reason: 'Appointment is not completed' };
    }

    // Validate feedback token
    if (!token || appointment.feedbackToken !== token) {
      return { canSubmit: false, reason: 'Invalid or expired feedback link' };
    }

    // Check if token has expired
    if (
      appointment.feedbackTokenExpiresAt &&
      new Date() > new Date(appointment.feedbackTokenExpiresAt)
    ) {
      return { canSubmit: false, reason: 'Feedback link has expired' };
    }

    const existingFeedback =
      await this.feedbackRepository.findByAppointmentId(appointmentId);
    if (existingFeedback) {
      return { canSubmit: false, reason: 'Feedback already submitted' };
    }

    // Get appointment details for the form
    const store = await this.storeRepository.findById(storeId);

    return {
      canSubmit: true,
      appointmentDetails: {
        serviceName: undefined, // Could fetch from service if needed
        staffName: undefined, // Could fetch from staff if needed
        appointmentDate: appointment.startDateTime?.toISOString(),
        storeName: store?.name,
      },
    };
  }
}
