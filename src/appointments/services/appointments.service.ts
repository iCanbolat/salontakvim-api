import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import {
  AppointmentRepository,
  AppointmentStatusCounts,
} from '../repositories/appointment.repository';
import { AppointmentExtraRepository } from '../repositories/appointment-extra.repository';
import { AvailabilityService } from './availability.service';
import { ServiceRepository } from '../../services/repositories/service.repository';
import { ServiceExtraRepository } from '../../services/repositories/service-extra.repository';
import { StaffMemberRepository } from '../../staff/repositories/staff-member.repository';
import { LocationRepository } from '../../locations/repositories/location.repository';
import { UserRepository } from '../../auth/repositories/user.repository';
import { StoreRepository } from '../../stores/repositories/store.repository';
import { NotificationService } from '../../notifications/services/notification.service';
import { ActivitiesService } from '../../activities/services/activities.service';
import {
  CreateAppointmentDto,
  CreateGuestAppointmentDto,
  UpdateAppointmentDto,
  UpdateAppointmentStatusDto,
  AppointmentResponseDto,
  GetStoreAppointmentsDto,
} from '../dto';
import { Appointment } from '../interfaces/repository.interface';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';

type AppointmentResponseCacheBundle = {
  userNames: Map<number, string | null>;
  serviceNames: Map<number, string | null>;
  staffNames: Map<number, string | null>;
  locationNames: Map<number, string | null>;
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
  constructor(
    private readonly appointmentRepository: AppointmentRepository,
    private readonly appointmentExtraRepository: AppointmentExtraRepository,
    private readonly availabilityService: AvailabilityService,
    private readonly serviceRepository: ServiceRepository,
    private readonly serviceExtraRepository: ServiceExtraRepository,
    private readonly staffMemberRepository: StaffMemberRepository,
    private readonly locationRepository: LocationRepository,
    private readonly userRepository: UserRepository,
    private readonly storeRepository: StoreRepository,
    private readonly notificationService: NotificationService,
    private readonly activitiesService: ActivitiesService,
  ) {}

  // ============= Customer Appointments =============

  async createAppointment(
    storeId: number,
    customerId: number,
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

    if (dto.staffId) {
      const staff = await this.staffMemberRepository.findByIdAndStoreId(
        dto.staffId,
        storeId,
      );
      if (!staff) {
        throw new NotFoundException('Staff member not found');
      }
    } else {
      // If no staff specified, assign to first available staff for this service
      // TODO: Implement smart staff assignment based on availability
      // For now, we'll get the first staff member that can perform this service
      const serviceStaff = await this.serviceRepository.findById(dto.serviceId);
      if (serviceStaff) {
        // Get first visible staff member from store
        const availableStaff =
          await this.staffMemberRepository.findVisibleByStoreId(storeId);
        if (availableStaff.length > 0) {
          assignedStaffId = availableStaff[0].id;
        } else {
          throw new BadRequestException('No available staff members found');
        }
      }
    }

    // Calculate total price and extras duration
    let totalPrice = parseFloat(service.price);
    let extrasDurationMinutes = 0;

    // Handle extras (support both 'extras' and 'extrasData' for backward compatibility)
    const extrasToProcess = dto.extrasData || dto.extras || [];
    const extrasData: Array<{
      extraId: number;
      quantity: number;
      price: string;
      duration: number;
    }> = [];
    if (extrasToProcess.length > 0) {
      for (const extra of extrasToProcess) {
        const serviceExtra = await this.serviceExtraRepository.findById(
          extra.extraId,
        );
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

    // Calculate end time (service duration + extras duration)
    const startDateTime = new Date(dto.startDateTime);
    const totalDurationMinutes = service.duration + extrasDurationMinutes;
    const endDateTime = new Date(
      startDateTime.getTime() + totalDurationMinutes * 60 * 1000,
    );

    // Check for conflicts with assigned staff
    if (assignedStaffId) {
      await this.checkAppointmentConflicts(
        assignedStaffId,
        startDateTime,
        endDateTime,
      );
    }

    // Create appointment
    const appointment = await this.appointmentRepository.create({
      storeId,
      customerId,
      serviceId: dto.serviceId,
      staffId: assignedStaffId,
      locationId: dto.locationId,
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

    await this.notifyStaffAndAdmin(
      storeId,
      assignedStaffId,
      'Yeni Randevu',
      `${service.name} için yeni bir randevu oluşturuldu.`,
      'appointment_created',
      { appointmentId: appointment.id },
    );

    await this.activitiesService.recordActivity(
      storeId,
      'appointment',
      `${service.name} için yeni randevu oluşturuldu`,
      {
        appointmentId: appointment.id,
        customerId,
        staffId: assignedStaffId || null,
        startDateTime,
        status: 'pending',
      },
    );

    // Load appointment with extras
    const appointmentWithExtras = await this.getAppointmentById(
      appointment.id,
      storeId,
    );

    return appointmentWithExtras;
  }

  async createGuestAppointment(
    storeId: number,
    dto: CreateGuestAppointmentDto,
  ): Promise<AppointmentResponseDto> {
    if (!dto.guestEmail || !dto.guestFirstName) {
      throw new BadRequestException(
        'guestEmail and guestFirstName are required for guest appointment creation',
      );
    }

    const guestEmail = dto.guestEmail;
    // Check if user exists with this email
    let customer = await this.userRepository.findByEmail(guestEmail);
    let createdNewCustomer = false;

    if (!customer) {
      // Create guest customer account
      const temporaryPassword = randomBytes(16).toString('hex');
      const hashedPassword = await bcrypt.hash(temporaryPassword, 10);

      customer = await this.userRepository.create({
        email: guestEmail,
        firstName: dto.guestFirstName,
        lastName: dto.guestLastName,
        phone: dto.guestPhone,
        password: hashedPassword,
        role: 'customer',
      });

      createdNewCustomer = true;
    }

    if (createdNewCustomer && customer) {
      await this.activitiesService.recordActivity(
        storeId,
        'customer',
        `${dto.guestFirstName} ${dto.guestLastName || ''} adlı yeni müşteri oluşturuldu`,
        {
          customerId: customer.id,
          email: guestEmail,
        },
      );
    }

    // Create appointment as authenticated user
    return await this.createAppointment(storeId, customer.id, dto);
  }

  async getMyAppointments(
    customerId: number,
  ): Promise<AppointmentResponseDto[]> {
    const appointments =
      await this.appointmentRepository.findByCustomerId(customerId);

    const cacheBundle = this.createAppointmentCacheBundle();
    return this.buildAppointmentResponses(appointments, cacheBundle);
  }

  async getAppointmentById(
    id: number,
    storeId: number,
  ): Promise<AppointmentResponseDto> {
    const appointment = await this.appointmentRepository.findByIdAndStoreId(
      id,
      storeId,
    );

    if (!appointment) {
      throw new NotFoundException('Appointment not found');
    }

    const cacheBundle = this.createAppointmentCacheBundle();
    return this.buildAppointmentResponse(appointment, cacheBundle);
  }

  async updateAppointment(
    id: number,
    storeId: number,
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

    // If updating date/time or staff, check for conflicts
    if (dto.startDateTime || dto.staffId) {
      const service = await this.serviceRepository.findById(
        appointment.serviceId!,
      );
      if (!service) {
        throw new NotFoundException('Service not found');
      }

      // Get existing extras duration for this appointment
      const appointmentExtras =
        await this.appointmentExtraRepository.findByAppointmentId(id);
      let extrasDurationMinutes = 0;
      for (const extra of appointmentExtras) {
        const serviceExtra = await this.serviceExtraRepository.findById(
          extra.extraId,
        );
        if (serviceExtra) {
          extrasDurationMinutes +=
            (serviceExtra.duration || 0) * extra.quantity;
        }
      }

      const startDateTime = dto.startDateTime
        ? new Date(dto.startDateTime)
        : appointment.startDateTime;
      const totalDurationMinutes = service.duration + extrasDurationMinutes;
      const endDateTime = new Date(
        startDateTime.getTime() + totalDurationMinutes * 60 * 1000,
      );
      const staffId = dto.staffId || appointment.staffId!;

      await this.checkAppointmentConflicts(
        staffId,
        startDateTime,
        endDateTime,
        id,
      );
    }

    const updateData: any = { ...dto };
    if (dto.startDateTime) {
      updateData.startDateTime = new Date(dto.startDateTime);
    }

    const updated = await this.appointmentRepository.update(id, updateData);

    if (dto.status && appointment.status !== updated.status) {
      await this.notifyStaffAndAdmin(
        storeId,
        appointment.staffId,
        'Randevu Durumu Güncellendi',
        `Randevu durumu ${updated.status} olarak güncellendi.`,
        'appointment_status_changed',
        {
          appointmentId: id,
          oldStatus: appointment.status,
          newStatus: updated.status,
        },
      );

      await this.activitiesService.recordActivity(
        storeId,
        'appointment',
        `Randevu durumu ${updated.status} olarak güncellendi`,
        {
          appointmentId: id,
          oldStatus: appointment.status,
          newStatus: updated.status,
        },
      );
    }
    return await this.getAppointmentById(updated.id, storeId);
  }

  async updateAppointmentStatus(
    id: number,
    storeId: number,
    dto: UpdateAppointmentStatusDto,
  ): Promise<AppointmentResponseDto> {
    const appointment = await this.appointmentRepository.findByIdAndStoreId(
      id,
      storeId,
    );

    if (!appointment) {
      throw new NotFoundException('Appointment not found');
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
      await this.notifyStaffAndAdmin(
        storeId,
        appointment.staffId,
        'Randevu Durumu Güncellendi',
        `Randevu durumu ${updated.status} olarak güncellendi.`,
        'appointment_status_changed',
        {
          appointmentId: id,
          oldStatus: previousStatus,
          newStatus: updated.status,
        },
      );

      await this.activitiesService.recordActivity(
        storeId,
        'appointment',
        `Randevu durumu ${updated.status} olarak güncellendi`,
        {
          appointmentId: id,
          oldStatus: previousStatus,
          newStatus: updated.status,
        },
      );
    }

    return await this.getAppointmentById(updated.id, storeId);
  }

  async cancelAppointment(
    id: number,
    customerId: number,
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
      { appointmentId: id, reason },
    );

    await this.activitiesService.recordActivity(
      appointment.storeId,
      'appointment',
      'Randevu müşteri tarafından iptal edildi',
      {
        appointmentId: id,
        cancelledBy: customerId,
        reason,
      },
    );

    return await this.getAppointmentById(updated.id, appointment.storeId);
  }

  // ============= Admin/Staff Appointments =============

  async getStoreAppointments(
    storeId: number,
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

  async deleteAppointment(id: number, storeId: number): Promise<void> {
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
    storeId: number,
    serviceId: number,
    staffId: number,
    date: string,
    locationId?: number,
    extrasDurationMinutes?: number,
    excludeAppointmentId?: number,
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
    storeId: number,
    staffId: number | null | undefined,
    title: string,
    message: string,
    type: string,
    metadata?: Record<string, any>,
  ) {
    const appointmentUrl = metadata?.appointmentId
      ? `/admin/appointments?search=${metadata.appointmentId}`
      : undefined;
    const enrichedMetadata = appointmentUrl
      ? { ...metadata, url: appointmentUrl }
      : metadata;

    let staffUserId: number | null = null;

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
  }

  private async checkAppointmentConflicts(
    staffId: number,
    startDateTime: Date,
    endDateTime: Date,
    excludeAppointmentId?: number,
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

  private createAppointmentCacheBundle(): AppointmentResponseCacheBundle {
    return {
      userNames: new Map<number, string | null>(),
      serviceNames: new Map<number, string | null>(),
      staffNames: new Map<number, string | null>(),
      locationNames: new Map<number, string | null>(),
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

    return new AppointmentResponseDto({
      ...appointment,
      extras,
      customerName,
      serviceName,
      staffName,
      locationName,
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
    serviceId?: number | null,
    cache?: Map<number, string | null>,
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
    staffId?: number | null,
    staffCache?: Map<number, string | null>,
    userCache?: Map<number, string | null>,
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
    locationId?: number | null,
    cache?: Map<number, string | null>,
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

  private async resolveUserName(
    userId?: number | null,
    cache?: Map<number, string | null>,
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
}
