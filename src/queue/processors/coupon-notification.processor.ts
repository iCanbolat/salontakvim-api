/**
 * Coupon Notification Queue Processor
 * Handles sending coupon assignment notifications via email/SMS
 */

import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { NOTIFICATION_QUEUE } from '../queue.module';
import { NotificationService } from '../../notifications/services/notification.service';

export interface CouponNotificationJobData {
  storeId: string;
  customerId: string;
  customerEmail: string | null;
  customerPhone: string | null;
  customerName: string;
  couponCode: string;
  couponName: string;
  discountText: string;
  validUntil: string;
  storeName: string;
  storePhone?: string | null;
  storeEmail?: string | null;
}

@Processor(NOTIFICATION_QUEUE)
export class CouponNotificationProcessor extends WorkerHost {
  private readonly logger = new Logger(CouponNotificationProcessor.name);

  constructor(private readonly notificationService: NotificationService) {
    super();
  }

  async process(job: Job<CouponNotificationJobData>): Promise<void> {
    this.logger.log(
      `Processing coupon notification for customer ${job.data.customerId}`,
    );

    try {
      await this.notificationService.sendCouponAssigned(
        job.data.storeId,
        job.data.customerEmail || '',
        job.data.customerPhone || null,
        {
          customerName: job.data.customerName,
          couponCode: job.data.couponCode,
          couponName: job.data.couponName,
          discountText: job.data.discountText,
          validUntil: job.data.validUntil,
          storeName: job.data.storeName,
          storePhone: job.data.storePhone || '',
          storeEmail: job.data.storeEmail || '',
        },
        'both',
      );

      this.logger.log(
        `Coupon notification sent for customer ${job.data.customerId}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to send coupon notification for customer ${job.data.customerId}`,
        error,
      );
      throw error;
    }
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job<CouponNotificationJobData>) {
    this.logger.debug(
      `Coupon notification job ${job.id} completed for customer ${job.data.customerId}`,
    );
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<CouponNotificationJobData>, error: Error) {
    this.logger.error(
      `Coupon notification job ${job.id} failed for customer ${job.data.customerId}: ${error.message}`,
    );
  }
}
