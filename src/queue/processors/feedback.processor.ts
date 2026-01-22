/**
 * Feedback Queue Processor
 * Handles sending feedback request emails/SMS asynchronously
 */

import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger, Inject } from '@nestjs/common';
import { Job } from 'bullmq';
import { eq } from 'drizzle-orm';
import { FEEDBACK_QUEUE } from '../queue.module';
import { DRIZZLE_ORM } from '../../db/drizzle.module';
import { appointments } from '../../db/schema';
import { NotificationService } from '../../notifications/services/notification.service';

export interface FeedbackJobData {
  appointmentId: string;
  storeId: string;
  customerId: string;
  customerEmail: string | null;
  customerPhone: string | null;
  customerName: string;
  serviceName: string | null;
  staffName: string | null;
  appointmentDateTime: string;
  feedbackToken: string;
  feedbackLink: string;
  channel: 'email' | 'sms' | 'both';
  storeName: string;
  storePhone?: string | null;
  storeEmail?: string | null;
}

@Processor(FEEDBACK_QUEUE)
export class FeedbackProcessor extends WorkerHost {
  private readonly logger = new Logger(FeedbackProcessor.name);

  constructor(
    @Inject(DRIZZLE_ORM) private readonly db: any,
    private readonly notificationService: NotificationService,
  ) {
    super();
  }

  async process(job: Job<FeedbackJobData>): Promise<void> {
    const { appointmentId, feedbackLink, channel } = job.data;

    this.logger.log(
      `Processing feedback request for appointment ${appointmentId}`,
    );
    this.logger.debug(
      `Feedback variables: storePhone=${job.data.storePhone || 'n/a'}, storeEmail=${job.data.storeEmail || 'n/a'}`,
    );

    try {
      // Send the feedback notification
      await this.notificationService.sendAppointmentFeedback(
        job.data.storeId,
        job.data.customerEmail || '',
        job.data.customerPhone || '',
        {
          customerName: job.data.customerName,
          serviceName: job.data.serviceName || 'Hizmet',
          staffName: job.data.staffName || 'Personel',
          appointmentDateTime: job.data.appointmentDateTime,
          feedbackLink: job.data.feedbackLink,
          storeName: job.data.storeName,
          storePhone: job.data.storePhone || '',
          storeEmail: job.data.storeEmail || '',
        },
        channel,
      );

      // Update appointment to mark feedback as sent
      await this.db
        .update(appointments)
        .set({
          feedbackSentAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(appointments.id, appointmentId));

      this.logger.log(
        `Feedback request sent successfully for appointment ${appointmentId}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to send feedback request for appointment ${appointmentId}`,
        error,
      );
      throw error; // Re-throw to trigger retry
    }
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job<FeedbackJobData>) {
    this.logger.debug(
      `Feedback job ${job.id} completed for appointment ${job.data.appointmentId}`,
    );
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<FeedbackJobData>, error: Error) {
    this.logger.error(
      `Feedback job ${job.id} failed for appointment ${job.data.appointmentId}: ${error.message}`,
    );
  }
}
