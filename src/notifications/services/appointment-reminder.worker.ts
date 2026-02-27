import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { randomBytes } from 'crypto';
import { NotificationService } from './notification.service';
import { NotificationRepository } from '../repositories/notification.repository';
import { AppointmentRepository } from '../../appointments/repositories/appointment.repository';
import { ServiceRepository } from '../../services/repositories/service.repository';
import { StaffMemberRepository } from '../../staff/repositories/staff-member.repository';
import { UserRepository } from '../../auth/repositories/user.repository';
import { LocationRepository } from '../../locations/repositories/location.repository';
import { TemplateVariables } from '../interfaces/notification.interface';

interface ReminderStoreContext {
  id: string;
  slug: string | null;
  name: string;
  phone: string | null;
  email: string | null;
}

interface ReminderPreload {
  serviceById: Map<string, any>;
  staffById: Map<string, any>;
  locationById: Map<string, any>;
  userById: Map<string, any>;
}

/**
 * Background worker that sends appointment reminders (24h / 1h) based on store settings.
 */
@Injectable()
export class AppointmentReminderWorker {
  private readonly logger = new Logger(AppointmentReminderWorker.name);
  private readonly appointmentConcurrency = 10;
  private readonly storeBatchSize = 10;
  private readonly storeConcurrency = 3;

  constructor(
    private readonly notificationService: NotificationService,
    private readonly notificationRepository: NotificationRepository,
    private readonly appointmentRepository: AppointmentRepository,
    private readonly serviceRepository: ServiceRepository,
    private readonly staffMemberRepository: StaffMemberRepository,
    private readonly userRepository: UserRepository,
    private readonly locationRepository: LocationRepository,
  ) {}

  // Run every 5 minutes
  @Cron(CronExpression.EVERY_5_MINUTES)
  async handleReminders() {
    this.logger.log('Starting appointment reminder worker...');
    const now = new Date();

    const window24Start = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const window24End = new Date(window24Start.getTime() + 5 * 60 * 1000);

    const window1hStart = new Date(now.getTime() + 60 * 60 * 1000);
    const window1hEnd = new Date(window1hStart.getTime() + 5 * 60 * 1000);

    const settingsList =
      await this.notificationRepository.getReminderEnabledSettings();

    if (!settingsList.length) {
      this.logger.log('No stores with reminders enabled found.');
      return;
    }

    this.logger.log(
      `Processing reminders for ${settingsList.length} stores...`,
    );

    await this.runWithConcurrency(
      settingsList,
      this.storeConcurrency,
      async (settings) => {
        const store: ReminderStoreContext = {
          id: settings.storeId,
          slug: settings.storeSlug,
          name: settings.storeName,
          phone: settings.storePhone,
          email: settings.storeEmail,
        };

        const windowTasks: Promise<void>[] = [];

        if (settings.reminder24hEnabled) {
          windowTasks.push(
            this.processWindow(store, '24h', window24Start, window24End),
          );
        }

        if (settings.reminder1hEnabled) {
          windowTasks.push(
            this.processWindow(store, '1h', window1hStart, window1hEnd),
          );
        }

        if (windowTasks.length > 0) {
          await Promise.all(windowTasks);
        }
      },
    );

    this.logger.log('Appointment reminder worker finished.');
  }

  private async processWindow(
    store: any,
    type: '24h' | '1h',
    windowStart: Date,
    windowEnd: Date,
  ) {
    const appointments = await this.appointmentRepository.findPendingReminders(
      store.id,
      windowStart,
      windowEnd,
      type,
    );

    if (appointments.length === 0) {
      return;
    }

    const preload = await this.preloadReminderDependencies(appointments);

    await this.runWithConcurrency(
      appointments,
      this.appointmentConcurrency,
      async (appointment) => {
        const claimed = await this.appointmentRepository.claimReminder(
          appointment.id,
          type,
        );

        if (!claimed) {
          return;
        }

        try {
          const customerUser = appointment.customerId
            ? preload.userById.get(appointment.customerId)
            : null;

          const variables = await this.buildTemplateVariables(
            appointment,
            store,
            preload,
            customerUser,
          );

          const recipientEmail = customerUser?.email || '';
          const recipientPhone = customerUser?.phone || null;

          if (!recipientEmail && !recipientPhone) {
            this.logger.warn(
              `Skipping reminder for appointment ${appointment.id} (no recipient)`,
            );
            return;
          }

          if (type === '24h') {
            await this.notificationService.sendAppointmentReminder24h(
              store.id,
              recipientEmail,
              recipientPhone,
              variables,
            );
          } else {
            await this.notificationService.sendAppointmentReminder1h(
              store.id,
              recipientEmail,
              recipientPhone,
              variables,
            );
          }
        } catch (error) {
          this.logger.error(
            `Failed to process ${type} reminder for appointment ${appointment.id}: ${error.message}`,
            error,
          );

          await this.appointmentRepository.resetReminderFlag(
            appointment.id,
            type,
          );
        }
      },
    );
  }

  private async buildTemplateVariables(
    appointment: any,
    store: ReminderStoreContext,
    preload: ReminderPreload,
    customerUser?: any,
  ) {
    const service = appointment.serviceId
      ? preload.serviceById.get(appointment.serviceId)
      : null;

    const staff = appointment.staffId
      ? preload.staffById.get(appointment.staffId)
      : null;

    const staffUser = staff?.userId ? preload.userById.get(staff.userId) : null;

    const location = appointment.locationId
      ? preload.locationById.get(appointment.locationId)
      : null;

    const now = new Date();
    const tokenValid =
      appointment.cancelToken &&
      appointment.cancelTokenExpiresAt &&
      appointment.cancelTokenExpiresAt > now &&
      !appointment.cancelTokenUsedAt;

    let cancelToken = appointment.cancelToken || null;

    if (!tokenValid) {
      cancelToken = randomBytes(32).toString('hex');
      const cancelTokenExpiresAt = new Date();
      cancelTokenExpiresAt.setDate(cancelTokenExpiresAt.getDate() + 2);

      await this.appointmentRepository.update(appointment.id, {
        cancelToken,
        cancelTokenExpiresAt,
        cancelTokenUsedAt: null,
      });
    }

    const cancelLink = cancelToken
      ? this.buildCancelLink(
          store?.slug,
          store?.id,
          appointment.id,
          cancelToken,
        )
      : '';

    const customerName = customerUser?.firstName || 'Müşteri';

    const appointmentDateTime = new Date(
      appointment.startDateTime,
    ).toLocaleString('tr-TR', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });

    const variables: TemplateVariables = {
      customerName,
      serviceName: service?.name || 'Hizmet',
      appointmentDateTime,
      staffName: staffUser?.firstName || staff?.id || 'Personel',
      duration: service?.duration,
      price: service?.price,
      storeName: store?.name,
      storePhone: store?.phone,
      storeEmail: store?.email,
      storeAddress: location?.address,
      cancelLink,
    };

    return variables;
  }

  private async preloadReminderDependencies(
    appointments: any[],
  ): Promise<ReminderPreload> {
    const serviceIds = Array.from(
      new Set(appointments.map((a) => a.serviceId).filter(Boolean)),
    );
    const staffIds = Array.from(
      new Set(appointments.map((a) => a.staffId).filter(Boolean)),
    );
    const locationIds = Array.from(
      new Set(appointments.map((a) => a.locationId).filter(Boolean)),
    );

    const [services, staffMembers, locations] = await Promise.all([
      this.serviceRepository.findByIds(serviceIds),
      this.staffMemberRepository.findByIds(staffIds),
      this.locationRepository.findByIds(locationIds),
    ]);

    const userIds = Array.from(
      new Set([
        ...appointments.map((a) => a.customerId).filter(Boolean),
        ...staffMembers.map((staff) => staff.userId).filter(Boolean),
      ]),
    );
    const users = await this.userRepository.findByIds(userIds);

    return {
      serviceById: new Map(services.map((service) => [service.id, service])),
      staffById: new Map(staffMembers.map((staff) => [staff.id, staff])),
      locationById: new Map(
        locations.map((location) => [location.id, location]),
      ),
      userById: new Map(users.map((user) => [user.id, user])),
    };
  }

  private async runWithConcurrency<T>(
    items: T[],
    concurrency: number,
    task: (item: T) => Promise<void>,
  ) {
    if (!items.length) return;

    const safeConcurrency = Math.max(1, Math.min(concurrency, items.length));
    let index = 0;

    const workers = Array.from({ length: safeConcurrency }, async () => {
      while (true) {
        const currentIndex = index;
        index += 1;

        if (currentIndex >= items.length) {
          return;
        }

        await task(items[currentIndex]);
      }
    });

    await Promise.all(workers);
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
}
