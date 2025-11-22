import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { AppointmentRepository } from '../repositories/appointment.repository';
import { AppointmentExtraRepository } from '../repositories/appointment-extra.repository';
import { AvailabilityService } from './availability.service';
import { ServiceRepository } from '../../services/repositories/service.repository';
import { ServiceExtraRepository } from '../../services/repositories/service-extra.repository';
import { StaffMemberRepository } from '../../staff/repositories/staff-member.repository';
import { LocationRepository } from '../../locations/repositories/location.repository';
import { UserRepository } from '../../auth/repositories/user.repository';
import {
  CreateAppointmentDto,
  CreateGuestAppointmentDto,
  UpdateAppointmentDto,
  UpdateAppointmentStatusDto,
  AppointmentResponseDto,
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

    // Calculate end time
    const startDateTime = new Date(dto.startDateTime);
    const endDateTime = new Date(
      startDateTime.getTime() + service.duration * 60 * 1000,
    );

    // Check for conflicts with assigned staff
    if (assignedStaffId) {
      await this.checkAppointmentConflicts(
        assignedStaffId,
        startDateTime,
        endDateTime,
      );
    }

    // Calculate total price
    let totalPrice = parseFloat(service.price);

    // Handle extras (support both 'extras' and 'extrasData' for backward compatibility)
    const extrasToProcess = dto.extrasData || dto.extras || [];
    const extrasData: Array<{
      extraId: number;
      quantity: number;
      price: string;
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
        extrasData.push({
          extraId: extra.extraId,
          quantity: extra.quantity,
          price: serviceExtra.price,
        });
      }
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
    // Check if user exists with this email
    let customer = await this.userRepository.findByEmail(dto.guestEmail);

    if (!customer) {
      // Create guest customer account
      const temporaryPassword = randomBytes(16).toString('hex');
      const hashedPassword = await bcrypt.hash(temporaryPassword, 10);

      customer = await this.userRepository.create({
        email: dto.guestEmail,
        firstName: dto.guestFirstName,
        lastName: dto.guestLastName,
        phone: dto.guestPhone,
        password: hashedPassword,
        role: 'customer',
      });
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
    if (['cancelled', 'completed'].includes(appointment.status)) {
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

      const startDateTime = dto.startDateTime
        ? new Date(dto.startDateTime)
        : appointment.startDateTime;
      const endDateTime = new Date(
        startDateTime.getTime() + service.duration * 60 * 1000,
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

    const updateData: any = {
      status: dto.status,
      internalNotes: dto.internalNotes,
    };

    if (dto.status === 'cancelled') {
      updateData.cancelledAt = new Date();
      updateData.cancellationReason = dto.cancellationReason;
    }

    const updated = await this.appointmentRepository.update(id, updateData);
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

    const updated = await this.appointmentRepository.update(id, {
      status: 'cancelled',
      cancelledAt: new Date(),
      cancellationReason: reason,
    });

    return await this.getAppointmentById(updated.id, appointment.storeId);
  }

  // ============= Admin/Staff Appointments =============

  async getStoreAppointments(
    storeId: number,
  ): Promise<AppointmentResponseDto[]> {
    const appointments =
      await this.appointmentRepository.findByStoreId(storeId);

    const cacheBundle = this.createAppointmentCacheBundle();
    return this.buildAppointmentResponses(appointments, cacheBundle);
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
    serviceId: number,
    staffId: number,
    date: string,
    locationId?: number,
  ) {
    const service = await this.serviceRepository.findById(serviceId);
    if (!service) {
      throw new NotFoundException('Service not found');
    }

    const staff = await this.staffMemberRepository.findById(staffId);
    if (!staff) {
      throw new NotFoundException('Staff member not found');
    }

    const slots = await this.availabilityService.getAvailableSlots(
      staffId,
      serviceId,
      date,
      service.duration,
      service.bufferTimeBefore || 0,
      service.bufferTimeAfter || 0,
    );

    return {
      date,
      serviceId,
      staffId,
      locationId,
      slots,
    };
  }

  // ============= Private Helper Methods =============

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
