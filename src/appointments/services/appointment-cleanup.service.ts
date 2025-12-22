import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { AppointmentRepository } from '../repositories/appointment.repository';

// Runs monthly to purge historical, non-pending appointments.
// Business-tier owners keep data for 6 months; others keep 1 month.
@Injectable()
export class AppointmentCleanupService {
  private readonly logger = new Logger(AppointmentCleanupService.name);

  constructor(private readonly appointmentRepository: AppointmentRepository) {}

  // 02:00 on the first day of each month
  @Cron('0 0 2 1 * *')
  async handleMonthlyCleanup(): Promise<void> {
    try {
      const now = new Date();
      const { deletedStandard, deletedBusiness, total } =
        await this.appointmentRepository.purgeOldNonPendingAppointments(
          now,
          1,
          6,
        );

      if (total > 0) {
        this.logger.log(
          `Purged ${total} appointments (standard=${deletedStandard}, business=${deletedBusiness})`,
        );
      }
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? `${error.message}\n${error.stack}`
          : String(error);
      this.logger.error('Failed monthly appointment cleanup', message);
    }
  }
}
