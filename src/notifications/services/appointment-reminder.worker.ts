import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { randomBytes } from 'crypto';
import { NotificationService } from './notification.service';
import { NotificationRepository } from '../repositories/notification.repository';
import { AppointmentRepository } from '../../appointments/repositories/appointment.repository';
import { StoreRepository } from '../../stores/repositories/store.repository';
import { ServiceRepository } from '../../services/repositories/service.repository';
import { StaffMemberRepository } from '../../staff/repositories/staff-member.repository';
import { UserRepository } from '../../auth/repositories/user.repository';
import { LocationRepository } from '../../locations/repositories/location.repository';
import { TemplateVariables } from '../interfaces/notification.interface';

/**
 * Background worker that sends appointment reminders (24h / 1h) based on store settings.
 */
@Injectable()
export class AppointmentReminderWorker {
  private readonly logger = new Logger(AppointmentReminderWorker.name);

  constructor(
    private readonly notificationService: NotificationService,
    private readonly notificationRepository: NotificationRepository,
    private readonly appointmentRepository: AppointmentRepository,
    private readonly storeRepository: StoreRepository,
    private readonly serviceRepository: ServiceRepository,
    private readonly staffMemberRepository: StaffMemberRepository,
    private readonly userRepository: UserRepository,
    private readonly locationRepository: LocationRepository,
  ) {}

  // Run every 5 minutes
  @Cron(CronExpression.EVERY_5_MINUTES)
  async handleReminders() {
    const now = new Date();

    const window24Start = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const window24End = new Date(window24Start.getTime() + 5 * 60 * 1000);

    const window1hStart = new Date(now.getTime() + 60 * 60 * 1000);
    const window1hEnd = new Date(window1hStart.getTime() + 5 * 60 * 1000);

    const settingsList =
      await this.notificationRepository.getReminderEnabledSettings();

    for (const settings of settingsList) {
      const storeId = settings.storeId;

      const store = await this.storeRepository.findById(storeId);

      if (!store) {
        this.logger.warn(
          `Skipping reminders for store ${storeId}: store not found`,
        );
        continue;
      }

      if (settings.reminder24hEnabled) {
        await this.processWindow(store, '24h', window24Start, window24End);
      }

      if (settings.reminder1hEnabled) {
        await this.processWindow(store, '1h', window1hStart, window1hEnd);
      }
    }
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

    for (const appointment of appointments) {
      const claimed = await this.appointmentRepository.claimReminder(
        appointment.id,
        type,
      );

      if (!claimed) {
        continue;
      }

      try {
        const variables = await this.buildTemplateVariables(appointment, store);

        const customerUser = appointment.customerId
          ? await this.userRepository.findById(appointment.customerId)
          : null;

        const recipientEmail =
          customerUser?.email || appointment.guestEmail || '';
        const recipientPhone =
          appointment.guestPhone || customerUser?.phone || null;

        if (!recipientEmail && !recipientPhone) {
          this.logger.warn(
            `Skipping reminder for appointment ${appointment.id} (no recipient)`,
          );
          continue;
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

        // Allow re-processing on next run if sending failed
        await this.appointmentRepository.resetReminderFlag(
          appointment.id,
          type,
        );
      }
    }
  }

  private async buildTemplateVariables(appointment: any, store: any) {
    const service = appointment.serviceId
      ? await this.serviceRepository.findById(appointment.serviceId)
      : null;

    const staff = appointment.staffId
      ? await this.staffMemberRepository.findById(appointment.staffId)
      : null;

    const staffUser = staff?.userId
      ? await this.userRepository.findById(staff.userId)
      : null;

    const customerUser = appointment.customerId
      ? await this.userRepository.findById(appointment.customerId)
      : null;

    const location = appointment.locationId
      ? await this.locationRepository.findById(appointment.locationId)
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

    const customerName =
      customerUser?.firstName || appointment.guestFirstName || 'Müşteri';

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
