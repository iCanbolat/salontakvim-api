import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Inject,
  Logger,
  forwardRef,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import {
  AppointmentRepository,
  AppointmentStatusCounts,
} from '../repositories/appointment.repository';
import { AppointmentExtraRepository } from '../repositories/appointment-extra.repository';
import { AvailabilityService } from './availability.service';
import { ServiceRepository } from '../../services/repositories/service.repository';
import { ServiceExtraRepository } from '../../services/repositories/service-extra.repository';
import { StaffMemberRepository } from '../../staff/repositories/staff-member.repository';
import { ServiceStaffRepository } from '../../staff/repositories/service-staff.repository';
import { LocationRepository } from '../../locations/repositories/location.repository';
import { UserRepository } from '../../auth/repositories/user.repository';
import { StoreRepository } from '../../stores/repositories/store.repository';
import { NotificationService } from '../../notifications/services/notification.service';
import { ActivitiesService } from '../../activities/services/activities.service';
import { CouponService } from '../../coupons/services/coupon.service';
import { FeedbackService } from '../../feedback/services/feedback.service';
import { CustomerFileService } from '../../stores/services/customer-file.service';
import { FEEDBACK_QUEUE } from '../../queue/queue.module';
import type { FeedbackJobData } from '../../queue/processors/feedback.processor';
import {
  CreateAppointmentDto,
  CreateCustomerAppointmentDto,
  UpdateAppointmentDto,
  UpdateAppointmentStatusDto,
  SettleAppointmentPaymentDto,
  AppointmentResponseDto,
  GetStoreAppointmentsDto,
} from '../dto';
import { Appointment } from '../interfaces/repository.interface';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';

type AppointmentResponseCacheBundle = {
  userNames: Map<string, string | null>;
  serviceNames: Map<string, string | null>;
  staffNames: Map<string, string | null>;
  locationNames: Map<string, string | null>;
  storeNames: Map<string, string | null>;
};

type PaginatedAppointmentsResult = {
  data: AppointmentResponseDto[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  statusCounts: AppointmentStatusCounts;
};

@Injectable()
export class AppointmentsService {
  private readonly logger = new Logger(AppointmentsService.name);

  constructor(
    private readonly appointmentRepository: AppointmentRepository,
    private readonly appointmentExtraRepository: AppointmentExtraRepository,
    private readonly availabilityService: AvailabilityService,
    private readonly serviceRepository: ServiceRepository,
    private readonly serviceExtraRepository: ServiceExtraRepository,
    private readonly staffMemberRepository: StaffMemberRepository,
    private readonly serviceStaffRepository: ServiceStaffRepository,
    private readonly locationRepository: LocationRepository,
    private readonly userRepository: UserRepository,
    private readonly storeRepository: StoreRepository,
    private readonly notificationService: NotificationService,
    private readonly activitiesService: ActivitiesService,
    private readonly couponService: CouponService,
    @Inject(forwardRef(() => FeedbackService))
    private readonly feedbackService: FeedbackService,
    private readonly customerFileService: CustomerFileService,
    @InjectQueue(FEEDBACK_QUEUE)
    private readonly feedbackQueue: Queue<FeedbackJobData>,
  ) {}

  // ============= Customer Appointments =============

  async createAppointment(
    storeId: string,
    customerId: string,
    dto: CreateAppointmentDto,
  ): Promise<AppointmentResponseDto> {
    // Validate service exists and belongs to store
    const service = await this.serviceRepository.findByIdAndStoreId(
      dto.serviceId,
      storeId,
    );
    if (!service) {
      throw new NotFoundException('Service not found');
    }

    // Validate staff exists and belongs to store (if provided)
    let assignedStaffId = dto.staffId;
    let resolvedLocationId = dto.locationId;

    if (dto.staffId) {
      const staff = await this.staffMemberRepository.findByIdAndStoreId(
        dto.staffId,
        storeId,
      );
      if (!staff) {
        throw new NotFoundException('Staff member not found');
      }

      if (!resolvedLocationId && staff.locationId) {
        resolvedLocationId = staff.locationId;
      }
    }

    // Calculate total price and extras duration
    let totalPrice = parseFloat(service.price);
    let extrasDurationMinutes = 0;

    // Ensure customer has a store-scoped public number
    await this.storeRepository.ensureStoreCustomer(storeId, customerId);

    // Handle extras (support both 'extras' and 'extrasData' for backward compatibility)
    const extrasToProcess = dto.extrasData || dto.extras || [];
    const extrasData: Array<{
      extraId: string;
      quantity: number;
      price: string;
      duration: number;
    }> = [];
    if (extrasToProcess.length > 0) {
      const serviceExtras = await this.serviceExtraRepository.findByIds(
        extrasToProcess.map((extra) => extra.extraId),
      );
      const serviceExtraMap = new Map(
        serviceExtras.map((serviceExtra) => [serviceExtra.id, serviceExtra]),
      );

      for (const extra of extrasToProcess) {
        const serviceExtra = serviceExtraMap.get(extra.extraId);
        if (!serviceExtra || serviceExtra.serviceId !== dto.serviceId) {
          throw new BadRequestException(
            `Invalid extra with ID ${extra.extraId}`,
          );
        }

        totalPrice += parseFloat(serviceExtra.price) * extra.quantity;
        extrasDurationMinutes += (serviceExtra.duration || 0) * extra.quantity;
        extrasData.push({
          extraId: extra.extraId,
          quantity: extra.quantity,
          price: serviceExtra.price,
          duration: serviceExtra.duration || 0,
        });
      }
    }

    const originalTotalPrice = totalPrice;
    let appliedCouponId: string | null = null;
    let discountAmount = 0;

    if (dto.couponCode) {
      const code = dto.couponCode.trim().toUpperCase();
      const validation = await this.couponService.validateCoupon(
        storeId,
        code,
        customerId,
        dto.serviceId,
        totalPrice,
      );

      discountAmount = Number(validation.discountAmount || 0);
      totalPrice = Math.max(0, totalPrice - discountAmount);
      appliedCouponId = validation.coupon?.id || null;
    }

    // Calculate end time (service duration + extras duration)
    const startDateTime = new Date(dto.startDateTime);
    const totalDurationMinutes = service.duration + extrasDurationMinutes;
    const endDateTime = new Date(
      startDateTime.getTime() + totalDurationMinutes * 60 * 1000,
    );

    if (!assignedStaffId) {
      // If no staff specified, assign to first available staff for this service
      const availableStaff =
        await this.staffMemberRepository.findVisibleByStoreId(storeId);
      const assignments = await this.serviceStaffRepository.findByServiceId(
        dto.serviceId,
      );
      const staffIdsForService = new Set(
        assignments.map((item) => item.staffId),
      );

      let eligibleStaff = availableStaff.filter((member) =>
        staffIdsForService.has(member.id),
      );

      if (dto.locationId) {
        eligibleStaff = eligibleStaff.filter(
          (member) => member.locationId === dto.locationId,
        );
      }

      if (!eligibleStaff.length) {
        throw new BadRequestException(
          'No available staff members found for the selected service',
        );
      }

      const [datePart, timePart] = dto.startDateTime.split('T');
      const requestedTime = timePart?.slice(0, 5);
      const availabilityByStaff = await this.runWithConcurrency(
        eligibleStaff,
        4,
        async (member) => {
          const slots = await this.availabilityService.getAvailableSlots(
            member.id,
            dto.serviceId,
            datePart,
            totalDurationMinutes,
            service.bufferTimeBefore || 0,
            service.bufferTimeAfter || 0,
          );

          return requestedTime
            ? slots.some(
                (slot) => slot.startTime === requestedTime && slot.available,
              )
            : slots.some((slot) => slot.available);
        },
      );

      const selectedStaffIndex = availabilityByStaff.findIndex(
        (isAvailable) => isAvailable,
      );

      if (selectedStaffIndex >= 0) {
        const selectedMember = eligibleStaff[selectedStaffIndex];
        assignedStaffId = selectedMember.id;
        if (!resolvedLocationId && selectedMember.locationId) {
          resolvedLocationId = selectedMember.locationId;
        }
      }

      if (!assignedStaffId) {
        throw new BadRequestException(
          'No available staff members found for the selected time',
        );
      }
    }

    // Check for conflicts with assigned staff
    if (assignedStaffId) {
      await this.checkAppointmentConflicts(
        assignedStaffId,
        startDateTime,
        endDateTime,
      );

      if (!resolvedLocationId) {
        const assignedStaff =
          await this.staffMemberRepository.findByIdAndStoreId(
            assignedStaffId,
            storeId,
          );
        resolvedLocationId = assignedStaff?.locationId || undefined;
      }
    }

    // Create appointment
    const appointment = await this.appointmentRepository.create({
      storeId,
      customerId,
      serviceId: dto.serviceId,
      staffId: assignedStaffId,
      locationId: resolvedLocationId,
      startDateTime,
      endDateTime,
      numberOfPeople: dto.numberOfPeople || 1,
      totalPrice: totalPrice.toFixed(2),
      customerNotes: dto.customerNotes,
      status: 'pending',
      isPaid: false,
      isRecurring: false,
    });

    // Create extras
    if (extrasData.length > 0) {
      const extras = extrasData.map((extra) => ({
        appointmentId: appointment.id,
        ...extra,
      }));
      await this.appointmentExtraRepository.createMany(extras);
    }

    // Increment store appointment count
    await this.appointmentRepository.incrementStoreAppointmentCount(storeId);

    const customerUser = await this.userRepository.findById(customerId);
    const customerName = customerUser
      ? [customerUser.firstName, customerUser.lastName]
          .filter(Boolean)
          .join(' ')
          .trim() ||
        customerUser.email ||
        customerUser.phone ||
        'Müşteri'
      : 'Müşteri';
    const appointmentDateTimeLabel = startDateTime.toLocaleString('tr-TR');

    await this.notifyStaffAndAdmin(
      storeId,
      assignedStaffId,
      'Yeni Randevu',
      `${customerName} için ${service.name} randevusu ${appointmentDateTimeLabel} tarihinde oluşturuldu.`,
      'appointment_created',
      {
        appointmentId: appointment.id,
        publicNumber: appointment.publicNumber,
        locationId: appointment.locationId || null,
      },
    );

    // Load appointment with extras
    const appointmentWithExtras = await this.getAppointmentById(
      appointment.id,
      storeId,
    );
    if (appliedCouponId && discountAmount > 0) {
      await this.couponService.applyCoupon(
        storeId,
        appliedCouponId,
        customerId,
        appointment.id,
        discountAmount,
        originalTotalPrice,
      );
    }

    return appointmentWithExtras;
  }

  async createCustomerAppointment(
    storeId: string,
    dto: CreateCustomerAppointmentDto,
  ): Promise<AppointmentResponseDto> {
    const customerEmail = dto.customerEmail;
    const customerFirstName = dto.customerFirstName;
    const customerLastName = dto.customerLastName;
    const customerPhone = dto.customerPhone;

    if (!customerEmail || !customerFirstName) {
      throw new BadRequestException(
        'customerEmail and customerFirstName are required for customer appointment creation',
      );
    }

    // Check if user exists with this email
    let customer = await this.userRepository.findByEmail(customerEmail);
    let createdNewCustomer = false;

    if (!customer) {
      // Create customer account
      const temporaryPassword = randomBytes(16).toString('hex');
      const hashedPassword = await bcrypt.hash(temporaryPassword, 10);

      customer = await this.userRepository.create({
        email: customerEmail,
        firstName: customerFirstName,
        lastName: customerLastName,
        phone: customerPhone,
        password: hashedPassword,
        role: 'customer',
      });

      createdNewCustomer = true;
    }

    if (createdNewCustomer && customer) {
      await this.activitiesService.recordActivity(
        storeId,
        'customer',
        `${customerFirstName} ${customerLastName || ''} adlı yeni müşteri oluşturuldu`,
        {
          customerId: customer.id,
          email: customerEmail,
        },
      );
    }

    await this.storeRepository.ensureStoreCustomer(storeId, customer.id);

    // Create appointment as authenticated user
    return await this.createAppointment(storeId, customer.id, dto);
  }

  async getMyAppointments(
    customerId: string,
  ): Promise<AppointmentResponseDto[]> {
    const appointments =
      await this.appointmentRepository.findByCustomerId(customerId);

    const cacheBundle = this.createAppointmentCacheBundle();
    return this.buildAppointmentResponses(appointments, cacheBundle);
  }

  async getAppointmentById(
    id: string,
    storeId: string,
    userId?: string,
  ): Promise<AppointmentResponseDto> {
    const appointment = await this.appointmentRepository.findByIdAndStoreId(
      id,
      storeId,
    );

    if (!appointment) {
      throw new NotFoundException('Appointment not found');
    }

    const cacheBundle = this.createAppointmentCacheBundle();
    const result = await this.buildAppointmentResponse(
      appointment,
      cacheBundle,
    );

    // Aggregate related data if userId is provided
    if (userId) {
      // 1. Feedback (only for completed appointments)
      if (result.status === 'completed') {
        try {
          // Use feedbackService to fetch feedback details
          const feedback = await this.feedbackService.findByAppointmentId(
            storeId,
            id,
            userId,
          );
          if (feedback) {
            result.feedback = feedback;
          }
        } catch (error) {
          // Ignore feedback fetch errors (it's optional data)
        }
      }

      // 2. Customer Files (recent 5)
      // Only if appointment has a customer
      if (result.customerId) {
        try {
          const files = await this.customerFileService.getFiles(
            storeId,
            result.customerId,
            userId,
            { appointmentId: id, limit: 10 },
          );
          result.files = files.data;
        } catch (error) {
          // Ignore file fetch errors
        }
      }

      // 3. Activities (recent 20)
      try {
        result.activities = await this.activitiesService.getRecentActivities(
          storeId,
          20,
          undefined,
          id,
        );
      } catch (error) {
        // Ignore activity fetch errors
      }
    }

    return result;
  }

  async updateAppointment(
    id: string,
    storeId: string,
    dto: UpdateAppointmentDto,
  ): Promise<AppointmentResponseDto> {
    const appointment = await this.appointmentRepository.findByIdAndStoreId(
      id,
      storeId,
    );

    if (!appointment) {
      throw new NotFoundException('Appointment not found');
    }

    // Don't allow updates to cancelled or completed appointments
    if (['cancelled', 'completed', 'expired'].includes(appointment.status)) {
      throw new BadRequestException(
        `Cannot update appointment with status: ${appointment.status}`,
      );
    }

    const effectiveServiceId = dto.serviceId || appointment.serviceId;
    if (!effectiveServiceId) {
      throw new BadRequestException('Service is required');
    }

    const service = await this.serviceRepository.findByIdAndStoreId(
      effectiveServiceId,
      storeId,
    );
    if (!service) {
      throw new NotFoundException('Service not found');
    }

    // Get existing extras duration and price for this appointment
    const appointmentExtras =
      await this.appointmentExtraRepository.findByAppointmentId(id);
    let extrasDurationMinutes = 0;
    let extrasTotalPrice = 0;

    const serviceExtras = await this.serviceExtraRepository.findByIds(
      appointmentExtras.map((extra) => extra.extraId),
    );
    const serviceExtraDurationMap = new Map(
      serviceExtras.map((serviceExtra) => [
        serviceExtra.id,
        serviceExtra.duration || 0,
      ]),
    );

    for (const extra of appointmentExtras) {
      const extraDuration = serviceExtraDurationMap.get(extra.extraId);

      if (extraDuration !== undefined) {
        extrasDurationMinutes += extraDuration * extra.quantity;
      }

      extrasTotalPrice += parseFloat(extra.price || '0') * extra.quantity;
    }

    const startDateTime = dto.startDateTime
      ? new Date(dto.startDateTime)
      : appointment.startDateTime;
    const totalDurationMinutes = service.duration + extrasDurationMinutes;
    const endDateTime = new Date(
      startDateTime.getTime() + totalDurationMinutes * 60 * 1000,
    );

    // If updating date/time, staff or service, check for conflicts using updated duration
    if (dto.startDateTime || dto.staffId || dto.serviceId) {
      const staffId = dto.staffId || appointment.staffId;

      if (staffId) {
        await this.checkAppointmentConflicts(
          staffId,
          startDateTime,
          endDateTime,
          id,
        );
      }
    }

    const updateData: any = { ...dto };
    if (dto.startDateTime) {
      updateData.startDateTime = new Date(dto.startDateTime);
    }

    if (dto.startDateTime || dto.serviceId) {
      updateData.endDateTime = endDateTime;
    }

    if (dto.serviceId) {
      const totalPrice = parseFloat(service.price) + extrasTotalPrice;
      updateData.totalPrice = totalPrice.toFixed(2);
    }

    const updated = await this.appointmentRepository.update(id, updateData);

    if (dto.status && appointment.status !== updated.status) {
      if (updated.status !== 'cancelled') {
        const activityMessage = await this.buildStatusActivityMessage(
          updated,
          updated.status,
        );
        await this.activitiesService.recordActivity(
          storeId,
          'appointment',
          activityMessage,
          {
            appointmentId: id,
            oldStatus: appointment.status,
            newStatus: updated.status,
            locationId: updated.locationId || appointment.locationId || null,
          },
        );
      }

      if (updated.status === 'completed') {
        await this.sendFeedbackRequest(updated);
      }

      if (updated.status === 'confirmed') {
        await this.sendAppointmentConfirmationNotification(updated);
      }
    }

    if (!dto.status) {
      const changedFields = Object.keys(dto || {}).filter(
        (key) => key !== 'status' && (dto as any)[key] !== undefined,
      );

      if (changedFields.length > 0) {
        const customerName = await this.resolveUserName(updated.customerId);
        const serviceName = await this.resolveServiceName(updated.serviceId);
        const details = [customerName, serviceName]
          .filter(Boolean)
          .join(' \u2022 ');
        const message = details
          ? `Randevu güncellendi: ${details}`
          : 'Randevu güncellendi';
        await this.activitiesService.recordActivity(
          storeId,
          'appointment',
          message,
          {
            appointmentId: id,
            changedFields,
            locationId: updated.locationId || appointment.locationId || null,
          },
        );
      }
    }
    return await this.getAppointmentById(updated.id, storeId);
  }

  async updateAppointmentStatus(
    id: string,
    storeId: string,
    dto: UpdateAppointmentStatusDto,
  ): Promise<AppointmentResponseDto> {
    const appointment = await this.appointmentRepository.findByIdAndStoreId(
      id,
      storeId,
    );

    if (!appointment) {
      throw new NotFoundException('Appointment not found');
    }

    if (appointment.status === 'completed') {
      throw new BadRequestException(
        'Completed appointments cannot be changed manually',
      );
    }

    if (dto.status === 'completed') {
      throw new BadRequestException(
        'Use settle payment with markAsPaid=true to complete an appointment',
      );
    }

    const previousStatus = appointment.status;

    const updateData: any = {
      status: dto.status,
      internalNotes: dto.internalNotes,
    };

    if (dto.status === 'cancelled') {
      updateData.cancelledAt = new Date();
      updateData.cancellationReason = dto.cancellationReason;
    }

    const updated = await this.appointmentRepository.update(id, updateData);

    if (previousStatus !== updated.status) {
      if (updated.status !== 'cancelled') {
        const activityMessage = await this.buildStatusActivityMessage(
          updated,
          updated.status,
        );
        await this.activitiesService.recordActivity(
          storeId,
          'appointment',
          activityMessage,
          {
            appointmentId: id,
            oldStatus: previousStatus,
            newStatus: updated.status,
            locationId: updated.locationId || appointment.locationId || null,
          },
        );
      }

      if (updated.status === 'confirmed') {
        await this.sendAppointmentConfirmationNotification(updated);
      }
    }

    return await this.getAppointmentById(updated.id, storeId);
  }

  async settleAppointmentPayment(
    id: string,
    storeId: string,
    dto: SettleAppointmentPaymentDto,
  ): Promise<AppointmentResponseDto> {
    const appointment = await this.appointmentRepository.findByIdAndStoreId(
      id,
      storeId,
    );

    if (!appointment) {
      throw new NotFoundException('Appointment not found');
    }

    if (['cancelled', 'expired'].includes(appointment.status)) {
      throw new BadRequestException(
        `Cannot settle payment for appointment with status: ${appointment.status}`,
      );
    }

    const depositAmount = Number(appointment.depositAmount || 0);
    const previousTotalPrice = Number(appointment.totalPrice || 0);
    const finalTotalPrice = Math.max(0, Number(dto.finalTotalPrice || 0));
    const remainingAmount = Math.max(0, finalTotalPrice - depositAmount);
    const markAsPaid = dto.markAsPaid ?? true;
    const shouldAutoComplete = markAsPaid && appointment.status !== 'completed';
    const isPriceChanged =
      previousTotalPrice.toFixed(2) !== finalTotalPrice.toFixed(2);

    const updated = await this.appointmentRepository.update(id, {
      totalPrice: finalTotalPrice.toFixed(2),
      isPaid: markAsPaid,
      paidAt: markAsPaid ? new Date() : null,
      ...(shouldAutoComplete ? { status: 'completed' } : {}),
    });

    const activityMessage = markAsPaid
      ? 'Randevu ödendi olarak işaretlendi.'
      : isPriceChanged
        ? 'Randevu fiyatı güncellendi.'
        : 'Randevu ödeme bilgisi güncellendi.';

    await this.activitiesService.recordActivity(
      storeId,
      'appointment',
      activityMessage,
      {
        appointmentId: id,
        previousTotalPrice: previousTotalPrice.toFixed(2),
        finalTotalPrice: finalTotalPrice.toFixed(2),
        depositAmount: depositAmount.toFixed(2),
        remainingAmount: remainingAmount.toFixed(2),
        isPaid: markAsPaid,
        locationId: updated.locationId || appointment.locationId || null,
      },
    );

    if (shouldAutoComplete) {
      const statusActivityMessage = await this.buildStatusActivityMessage(
        updated,
        'completed',
      );

      await this.activitiesService.recordActivity(
        storeId,
        'appointment',
        statusActivityMessage,
        {
          appointmentId: id,
          oldStatus: appointment.status,
          newStatus: 'completed',
          locationId: updated.locationId || appointment.locationId || null,
        },
      );

      await this.sendFeedbackRequest(updated);
    }

    return this.getAppointmentById(id, storeId);
  }

  async cancelAppointment(
    id: string,
    customerId: string,
    reason?: string,
  ): Promise<AppointmentResponseDto> {
    const appointment = await this.appointmentRepository.findById(id);

    if (!appointment) {
      throw new NotFoundException('Appointment not found');
    }

    if (appointment.customerId !== customerId) {
      throw new BadRequestException(
        'You can only cancel your own appointments',
      );
    }

    if (appointment.status === 'cancelled') {
      throw new BadRequestException('Appointment is already cancelled');
    }

    if (appointment.status === 'completed') {
      throw new BadRequestException('Cannot cancel completed appointment');
    }

    if (appointment.status === 'expired') {
      throw new BadRequestException('Cannot cancel expired appointment');
    }

    const updated = await this.appointmentRepository.update(id, {
      status: 'cancelled',
      cancelledAt: new Date(),
      cancellationReason: reason,
    });

    await this.notifyStaffAndAdmin(
      appointment.storeId,
      appointment.staffId,
      'Randevu İptal Edildi',
      'Müşteri tarafından randevu iptal edildi.',
      'appointment_cancelled',
      {
        appointmentId: id,
        publicNumber: appointment.publicNumber,
        reason,
      },
    );

    return await this.getAppointmentById(updated.id, appointment.storeId);
  }

  async getAppointmentByToken(token: string): Promise<AppointmentResponseDto> {
    if (!token) {
      throw new BadRequestException('Cancellation token is required');
    }

    const appointment =
      await this.appointmentRepository.findByCancelToken(token);

    if (!appointment) {
      throw new NotFoundException('Appointment not found');
    }

    if (appointment.cancelTokenUsedAt) {
      throw new BadRequestException('Cancellation link already used');
    }

    if (
      appointment.cancelTokenExpiresAt &&
      appointment.cancelTokenExpiresAt < new Date()
    ) {
      throw new BadRequestException('Cancellation link expired');
    }

    return await this.getAppointmentById(appointment.id, appointment.storeId);
  }

  async cancelAppointmentByToken(
    token: string,
    reason?: string,
  ): Promise<AppointmentResponseDto> {
    if (!token) {
      throw new BadRequestException('Cancellation token is required');
    }

    const appointment =
      await this.appointmentRepository.findByCancelToken(token);

    if (!appointment) {
      throw new NotFoundException('Appointment not found');
    }

    if (appointment.cancelTokenUsedAt) {
      throw new BadRequestException('Cancellation link already used');
    }

    if (
      appointment.cancelTokenExpiresAt &&
      appointment.cancelTokenExpiresAt < new Date()
    ) {
      throw new BadRequestException('Cancellation link expired');
    }

    if (['cancelled', 'completed', 'expired'].includes(appointment.status)) {
      throw new BadRequestException(
        `Cannot cancel appointment with status: ${appointment.status}`,
      );
    }

    const updated = await this.appointmentRepository.update(appointment.id, {
      status: 'cancelled',
      cancelledAt: new Date(),
      cancellationReason: reason || 'İptal linki ile iptal edildi',
      cancelTokenUsedAt: new Date(),
    });

    await this.notifyStaffAndAdmin(
      appointment.storeId,
      appointment.staffId,
      'Randevu İptal Edildi',
      `Müşteri randevusunu iptal linki üzerinden iptal etti.${reason ? ` Sebep: ${reason}` : ''}`,
      'appointment_cancelled',
      {
        appointmentId: appointment.id,
        publicNumber: appointment.publicNumber,
        reason: reason || 'cancel_link',
      },
    );

    return await this.getAppointmentById(updated.id, appointment.storeId);
  }

  // ============= Admin/Staff Appointments =============

  async getStoreAppointments(
    storeId: string,
    filters: GetStoreAppointmentsDto = new GetStoreAppointmentsDto(),
  ): Promise<PaginatedAppointmentsResult> {
    const normalizedFilters = filters;

    const {
      data,
      total,
      page: currentPage,
      limit,
      totalPages,
    } = await this.appointmentRepository.findByStoreIdWithFilters(
      storeId,
      normalizedFilters,
    );

    const cacheBundle = this.createAppointmentCacheBundle();
    const responseData = await this.buildAppointmentResponses(
      data,
      cacheBundle,
    );

    const statusCounts = await this.appointmentRepository.countByStatus(
      storeId,
      {
        ...normalizedFilters,
        status: undefined,
      },
    );

    return {
      data: responseData,
      total,
      page: currentPage,
      limit,
      totalPages,
      statusCounts,
    };
  }

  async deleteAppointment(id: string, storeId: string): Promise<void> {
    const appointment = await this.appointmentRepository.findByIdAndStoreId(
      id,
      storeId,
    );

    if (!appointment) {
      throw new NotFoundException('Appointment not found');
    }

    await this.appointmentRepository.delete(id);
  }

  // ============= Availability =============

  async getAvailability(
    storeId: string,
    serviceId: string,
    staffId: string,
    date: string,
    locationId?: string,
    extrasDurationMinutes?: number,
    excludeAppointmentId?: string,
  ) {
    const service = await this.serviceRepository.findByIdAndStoreId(
      serviceId,
      storeId,
    );
    if (!service) {
      throw new NotFoundException('Service not found');
    }

    const staff = await this.staffMemberRepository.findByIdAndStoreId(
      staffId,
      storeId,
    );
    if (!staff) {
      throw new NotFoundException('Staff member not found');
    }

    if (locationId) {
      const location = await this.locationRepository.findByIdAndStoreId(
        locationId,
        storeId,
      );
      if (!location) {
        throw new NotFoundException('Location not found');
      }
    }

    const extraDuration = extrasDurationMinutes ?? 0;
    const totalServiceDuration = service.duration + extraDuration;

    const slots = await this.availabilityService.getAvailableSlots(
      staffId,
      serviceId,
      date,
      totalServiceDuration,
      service.bufferTimeBefore || 0,
      service.bufferTimeAfter || 0,
      excludeAppointmentId,
    );

    return {
      date,
      serviceId,
      staffId,
      locationId,
      slots,
      extrasDurationMinutes: extraDuration,
    };
  }

  // ============= Private Helper Methods =============

  private async notifyStaffAndAdmin(
    storeId: string,
    staffId: string | null | undefined,
    title: string,
    message: string,
    type: string,
    metadata?: Record<string, any>,
  ) {
    const appointmentUrl = metadata?.publicNumber
      ? `/appointments?search=${metadata.publicNumber}`
      : undefined;
    const enrichedMetadata = appointmentUrl
      ? { ...metadata, url: appointmentUrl }
      : metadata;

    let staffUserId: string | null = null;

    if (staffId) {
      const staff = await this.staffMemberRepository.findById(staffId);
      if (staff?.userId) {
        staffUserId = staff.userId;
        await this.notificationService.createInAppNotification(
          staff.userId,
          storeId,
          title,
          message,
          type,
          enrichedMetadata,
        );
      }
    }

    const store = await this.storeRepository.findById(storeId);
    if (store?.ownerId && store.ownerId !== staffUserId) {
      await this.notificationService.createInAppNotification(
        store.ownerId,
        storeId,
        title,
        message,
        type,
        enrichedMetadata,
      );
    }

    const locationId = metadata?.locationId;
    if (type === 'appointment_created' && locationId) {
      const managerUserIds =
        await this.staffMemberRepository.findManagerUserIdsByStoreAndLocation(
          storeId,
          locationId,
        );

      const managerTargets = managerUserIds.filter(
        (managerId) =>
          managerId !== staffUserId && managerId !== store?.ownerId,
      );

      await Promise.all(
        managerTargets.map((managerId) =>
          this.notificationService.createInAppNotification(
            managerId,
            storeId,
            title,
            message,
            type,
            enrichedMetadata,
          ),
        ),
      );
    }
  }

  private buildFeedbackLink(
    storeSlug: string | null | undefined,
    storeId: string,
    appointmentId: string,
    feedbackToken: string,
  ) {
    const baseUrl = (
      process.env.FRONTEND_URL || 'http://localhost:3000'
    ).replace(/\/$/, '');
    const params = new URLSearchParams({
      appointmentId,
      storeId,
      token: feedbackToken,
    });

    if (storeSlug) {
      params.set('storeSlug', storeSlug);
    }

    return `${baseUrl}/appointments/feedback?${params.toString()}`;
  }

  private buildCancelLink(
    storeSlug: string | null | undefined,
    storeId: string,
    appointmentId: string,
    cancelToken: string,
  ) {
    const baseUrl = (
      process.env.FRONTEND_URL || 'http://localhost:3000'
    ).replace(/\/$/, '');
    const params = new URLSearchParams({
      appointmentId,
      storeId,
      token: cancelToken,
    });

    if (storeSlug) {
      params.set('storeSlug', storeSlug);
    }

    return `${baseUrl}/appointments/cancel?${params.toString()}`;
  }

  private generateFeedbackToken(): string {
    return randomBytes(32).toString('hex');
  }

  private generateCancelToken(): string {
    return randomBytes(32).toString('hex');
  }

  private async sendFeedbackRequest(appointment: Appointment) {
    if (!appointment.customerId) {
      return;
    }

    // Check if feedback was already sent
    if (appointment.feedbackSentAt) {
      return;
    }

    const [store, customer, service, staff] = await Promise.all([
      this.storeRepository.findById(appointment.storeId),
      this.userRepository.findById(appointment.customerId),
      appointment.serviceId
        ? this.serviceRepository.findById(appointment.serviceId)
        : Promise.resolve(null),
      appointment.staffId
        ? this.staffMemberRepository.findById(appointment.staffId)
        : Promise.resolve(null),
    ]);

    if (!store || !customer) {
      return;
    }

    // Generate feedback token with 7 day expiration
    const feedbackToken = this.generateFeedbackToken();
    const feedbackTokenExpiresAt = new Date();
    feedbackTokenExpiresAt.setDate(feedbackTokenExpiresAt.getDate() + 7);

    // Update appointment with feedback token
    await this.appointmentRepository.update(appointment.id, {
      feedbackToken,
      feedbackTokenExpiresAt,
    });

    const staffUser = staff?.userId
      ? await this.userRepository.findById(staff.userId)
      : null;

    const customerName =
      [customer.firstName, customer.lastName]
        .filter(Boolean)
        .join(' ')
        .trim() ||
      customer.email ||
      customer.phone ||
      'Müşteri';

    const staffName = staffUser
      ? [staffUser.firstName, staffUser.lastName]
          .filter(Boolean)
          .join(' ')
          .trim() || staffUser.email
      : 'Personel';

    const appointmentDateTime = appointment.startDateTime
      ? new Date(appointment.startDateTime).toLocaleString('tr-TR')
      : '';

    const feedbackLink = this.buildFeedbackLink(
      store.slug,
      store.id,
      appointment.id,
      feedbackToken,
    );

    const notificationSettings = await this.notificationService.getSettings(
      store.id,
    );
    const channel = notificationSettings?.feedbackRequestSmsEnabled
      ? 'both'
      : 'email';

    this.logger.log(
      `Preparing feedback request for appointment ${appointment.id} (channel=${channel}, email=${customer.email || 'n/a'}, phone=${customer.phone || 'n/a'})`,
    );
    this.logger.debug(
      `Feedback variables for appointment ${appointment.id}: storePhone=${store.phone || 'n/a'}, storeEmail=${store.email || 'n/a'}`,
    );

    // Add job to feedback queue with 1 minute delay (fallback to direct send if queue fails)
    try {
      await this.feedbackQueue.add(
        'send-feedback-request',
        {
          appointmentId: appointment.id,
          storeId: store.id,
          customerId: customer.id,
          customerEmail: customer.email,
          customerPhone: customer.phone,
          customerName,
          serviceName: service?.name || null,
          staffName,
          appointmentDateTime,
          feedbackToken,
          feedbackLink,
          channel,
          storeName: store.name,
          storePhone: store.phone || null,
          storeEmail: store.email || null,
        },
        {
          delay: 1 * 60 * 1000,
          jobId: `feedback-${appointment.id}`,
        },
      );
      this.logger.log(
        `Queued feedback request for appointment ${appointment.id}`,
      );
    } catch (error) {
      this.logger.error(
        `Feedback queue unavailable, sending immediately for appointment ${appointment.id}`,
        error as Error,
      );

      await this.notificationService.sendAppointmentFeedback(
        store.id,
        customer.email || '',
        customer.phone || null,
        {
          customerName,
          serviceName: service?.name || 'Hizmet',
          appointmentDateTime,
          staffName,
          storeName: store.name,
          storePhone: store.phone || '',
          storeEmail: store.email || '',
          feedbackLink,
        },
        channel,
      );

      await this.appointmentRepository.update(appointment.id, {
        feedbackSentAt: new Date(),
      });
    }
  }

  private async checkAppointmentConflicts(
    staffId: string,
    startDateTime: Date,
    endDateTime: Date,
    excludeAppointmentId?: string,
  ): Promise<void> {
    const overlapping =
      await this.appointmentRepository.findOverlappingAppointments(
        staffId,
        startDateTime,
        endDateTime,
        excludeAppointmentId,
      );

    if (overlapping.length > 0) {
      throw new ConflictException(
        'This time slot is not available. Please choose another time.',
      );
    }
  }

  private async sendAppointmentConfirmationNotification(
    appointment: Appointment,
  ): Promise<void> {
    try {
      const store = await this.storeRepository.findById(appointment.storeId);
      if (!store) {
        this.logger.warn(
          `Store not found for appointment ${appointment.id}; skipping confirmation notification`,
        );
        return;
      }

      const service = appointment.serviceId
        ? await this.serviceRepository.findById(appointment.serviceId)
        : null;

      const staff = appointment.staffId
        ? await this.staffMemberRepository.findById(appointment.staffId)
        : null;
      const staffUser = staff?.userId
        ? await this.userRepository.findById(staff.userId)
        : null;

      const customer = appointment.customerId
        ? await this.userRepository.findById(appointment.customerId)
        : null;

      const location = appointment.locationId
        ? await this.locationRepository.findById(appointment.locationId)
        : null;

      const customerName =
        [customer?.firstName, customer?.lastName]
          .filter(Boolean)
          .join(' ')
          .trim() ||
        customer?.email ||
        customer?.phone ||
        'Müşteri';

      const staffName = staffUser
        ? [staffUser.firstName, staffUser.lastName]
            .filter(Boolean)
            .join(' ')
            .trim() || staffUser.email
        : 'Personel';

      const appointmentDateTime = appointment.startDateTime
        ? new Date(appointment.startDateTime).toLocaleString('tr-TR')
        : '';

      const durationMinutes = service?.duration
        ? service.duration
        : appointment.startDateTime && appointment.endDateTime
          ? Math.round(
              (new Date(appointment.endDateTime).getTime() -
                new Date(appointment.startDateTime).getTime()) /
                60000,
            )
          : '';

      const recipientEmail = customer?.email || '';
      const recipientPhone = customer?.phone || null;

      const now = new Date();
      const tokenValid =
        appointment.cancelToken &&
        appointment.cancelTokenExpiresAt &&
        appointment.cancelTokenExpiresAt > now &&
        !appointment.cancelTokenUsedAt;

      let cancelToken = appointment.cancelToken || null;
      let cancelTokenExpiresAt = appointment.cancelTokenExpiresAt || null;

      if (!tokenValid) {
        cancelToken = this.generateCancelToken();
        cancelTokenExpiresAt = new Date();
        cancelTokenExpiresAt.setDate(cancelTokenExpiresAt.getDate() + 2);

        await this.appointmentRepository.update(appointment.id, {
          cancelToken,
          cancelTokenExpiresAt,
          cancelTokenUsedAt: null,
        });
      }

      const cancelLink = cancelToken
        ? this.buildCancelLink(
            store.slug,
            store.id,
            appointment.id,
            cancelToken,
          )
        : '';

      await this.notificationService.sendAppointmentConfirmation(
        store.id,
        recipientEmail,
        recipientPhone,
        {
          customerName,
          serviceName: service?.name || 'Hizmet',
          appointmentDateTime,
          staffName,
          duration: durationMinutes,
          price: appointment.totalPrice || service?.price || '',
          storeName: store.name,
          storePhone: store.phone || '',
          storeEmail: store.email || '',
          storeAddress: location?.address || '',
          cancelLink,
        },
      );
    } catch (error) {
      this.logger.error(
        `Failed to send appointment confirmation for ${appointment.id}: ${error.message}`,
        error,
      );
    }
  }

  private createAppointmentCacheBundle(): AppointmentResponseCacheBundle {
    return {
      userNames: new Map<string, string | null>(),
      serviceNames: new Map<string, string | null>(),
      staffNames: new Map<string, string | null>(),
      locationNames: new Map<string, string | null>(),
      storeNames: new Map<string, string | null>(),
    };
  }

  private async buildAppointmentResponse(
    appointment: Appointment,
    cacheBundle?: AppointmentResponseCacheBundle,
  ): Promise<AppointmentResponseDto> {
    const bundle = cacheBundle ?? this.createAppointmentCacheBundle();
    const extras = await this.appointmentExtraRepository.findByAppointmentId(
      appointment.id,
    );
    const customerName = await this.resolveUserName(
      appointment.customerId,
      bundle.userNames,
    );
    const serviceName = await this.resolveServiceName(
      appointment.serviceId,
      bundle.serviceNames,
    );
    const staffName = await this.resolveStaffName(
      appointment.staffId,
      bundle.staffNames,
      bundle.userNames,
    );
    const locationName = await this.resolveLocationName(
      appointment.locationId,
      bundle.locationNames,
    );
    const storeName = await this.resolveStoreName(
      appointment.storeId,
      bundle.storeNames,
    );
    const customer = appointment.customerId
      ? await this.userRepository.findById(appointment.customerId)
      : null;

    return new AppointmentResponseDto({
      ...appointment,
      remainingAmount: Math.max(
        0,
        Number(appointment.totalPrice || 0) -
          Number(appointment.depositAmount || 0),
      ).toFixed(2),
      extras,
      customerName,
      customerLastName: customer?.lastName,
      email: customer?.email,
      phone: customer?.phone,
      serviceName,
      staffName,
      locationName,
      storeName,
    } as any);
  }

  private async buildAppointmentResponses(
    appointments: Appointment[],
    cacheBundle?: AppointmentResponseCacheBundle,
  ): Promise<AppointmentResponseDto[]> {
    const bundle = cacheBundle ?? this.createAppointmentCacheBundle();
    return Promise.all(
      appointments.map((appointment) =>
        this.buildAppointmentResponse(appointment, bundle),
      ),
    );
  }

  private async resolveServiceName(
    serviceId?: string | null,
    cache?: Map<string, string | null>,
  ): Promise<string | undefined> {
    if (!serviceId) {
      return undefined;
    }

    if (cache?.has(serviceId)) {
      const cached = cache.get(serviceId);
      return cached ?? undefined;
    }

    const service = await this.serviceRepository.findById(serviceId);
    const name = service?.name;

    cache?.set(serviceId, name ?? null);
    return name;
  }

  private async resolveStaffName(
    staffId?: string | null,
    staffCache?: Map<string, string | null>,
    userCache?: Map<string, string | null>,
  ): Promise<string | undefined> {
    if (!staffId) {
      return undefined;
    }

    if (staffCache?.has(staffId)) {
      const cached = staffCache.get(staffId);
      return cached ?? undefined;
    }

    const staff = await this.staffMemberRepository.findById(staffId);
    if (!staff?.userId) {
      staffCache?.set(staffId, null);
      return undefined;
    }

    const userName = await this.resolveUserName(staff.userId, userCache);
    staffCache?.set(staffId, userName ?? null);
    return userName;
  }

  private async resolveLocationName(
    locationId?: string | null,
    cache?: Map<string, string | null>,
  ): Promise<string | undefined> {
    if (!locationId) {
      return undefined;
    }

    if (cache?.has(locationId)) {
      const cached = cache.get(locationId);
      return cached ?? undefined;
    }

    const location = await this.locationRepository.findById(locationId);
    const name = location?.name;
    cache?.set(locationId, name ?? null);
    return name;
  }

  private async resolveStoreName(
    storeId?: string | null,
    cache?: Map<string, string | null>,
  ): Promise<string | undefined> {
    if (!storeId) {
      return undefined;
    }

    if (cache?.has(storeId)) {
      const cached = cache.get(storeId);
      return cached ?? undefined;
    }

    const store = await this.storeRepository.findById(storeId);
    const name = store?.name;
    cache?.set(storeId, name ?? null);
    return name;
  }

  private async resolveUserName(
    userId?: string | null,
    cache?: Map<string, string | null>,
  ): Promise<string | undefined> {
    if (!userId) {
      return undefined;
    }

    if (cache?.has(userId)) {
      const cached = cache.get(userId);
      return cached ?? undefined;
    }

    const user = await this.userRepository.findById(userId);
    const name =
      user && (user.firstName || user.lastName)
        ? `${user.firstName || ''} ${user.lastName || ''}`.trim()
        : user?.email || undefined;

    cache?.set(userId, name ?? null);
    return name;
  }

  private async runWithConcurrency<Item, Result>(
    items: Item[],
    concurrency: number,
    task: (item: Item, index: number) => Promise<Result>,
  ): Promise<Result[]> {
    if (!items.length) {
      return [];
    }

    const workerCount = Math.max(1, Math.min(concurrency, items.length));
    const results = new Array<Result>(items.length);
    let nextIndex = 0;

    await Promise.all(
      Array.from({ length: workerCount }, async () => {
        while (true) {
          const currentIndex = nextIndex;
          nextIndex += 1;

          if (currentIndex >= items.length) {
            return;
          }

          results[currentIndex] = await task(items[currentIndex], currentIndex);
        }
      }),
    );

    return results;
  }

  private getStatusLabel(status: string): { verb: string; label: string } {
    switch (status) {
      case 'confirmed':
        return { verb: 'onaylandı', label: 'Onaylandı' };
      case 'completed':
        return { verb: 'tamamlandı', label: 'Tamamlandı' };
      case 'no_show':
        return { verb: 'gelmedi olarak işaretlendi', label: 'Gelmedi' };
      case 'pending':
        return { verb: 'beklemeye alındı', label: 'Beklemede' };
      case 'expired':
        return { verb: 'süresi doldu', label: 'Süresi Doldu' };
      default:
        return {
          verb: `${status} olarak güncellendi`,
          label: status,
        };
    }
  }

  private async buildStatusActivityMessage(
    appointment: Appointment,
    status: string,
  ): Promise<string> {
    const { verb } = this.getStatusLabel(status);

    const customerName = await this.resolveUserName(appointment.customerId);
    const serviceName = await this.resolveServiceName(appointment.serviceId);
    const dateStr = appointment.startDateTime
      ? appointment.startDateTime.toLocaleString('tr-TR', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })
      : '';

    const details = [customerName, serviceName, dateStr]
      .filter(Boolean)
      .join(' \u2022 ');

    return details ? `Randevu ${verb}: ${details}` : `Randevu ${verb}`;
  }
}
