import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AppointmentRepository } from '../repositories/appointment.repository';

@Injectable()
export class AppointmentExpirationService {
  private readonly logger = new Logger(AppointmentExpirationService.name);

  constructor(private readonly appointmentRepository: AppointmentRepository) {}

  @Cron(CronExpression.EVERY_10_MINUTES)
  async handleExpiredAppointments(): Promise<void> {
    try {
      const now = new Date();
      const updatedCount =
        await this.appointmentRepository.markExpiredAppointments(now);

      if (updatedCount > 0) {
        this.logger.log(`Marked ${updatedCount} appointments as expired`);
      }
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? `${error.message}\n${error.stack}`
          : String(error);
      this.logger.error('Failed to mark expired appointments', message);
    }
  }
}
