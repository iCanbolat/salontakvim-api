import { Injectable, Logger } from '@nestjs/common';
import { NotificationRepository } from '../repositories/notification.repository';
import { TemplateService } from './template.service';
import { EmailService } from './email.service';
import { SmsService } from './sms.service';
import { NotificationsGateway } from '../notifications.gateway';
import {
  UpdateNotificationSettingsDto,
  UpdateTemplateDto,
  TestNotificationDto,
} from '../dto';
import { TemplateVariables } from '../interfaces/notification.interface';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    private readonly repository: NotificationRepository,
    private readonly templateService: TemplateService,
    private readonly emailService: EmailService,
    private readonly smsService: SmsService,
    private readonly notificationsGateway: NotificationsGateway,
  ) {}

  /**
   * Get notification settings
   */
  async getSettings(storeId: string) {
    return this.repository.getOrCreateSettings(storeId);
  }

  /**
   * Update notification settings
   */
  async updateSettings(storeId: string, dto: UpdateNotificationSettingsDto) {
    return this.repository.updateSettings(storeId, dto);
  }

  /**
   * Get all templates
   */
  async getAllTemplates(storeId: string) {
    return this.templateService.getAllTemplates(storeId);
  }

  /**
   * Get specific template
   */
  async getTemplate(storeId: string, templateType: string) {
    return this.templateService.getTemplate(storeId, templateType);
  }

  /**
   * Update template
   */
  async updateTemplate(
    storeId: string,
    templateType: string,
    dto: UpdateTemplateDto,
  ) {
    return this.templateService.updateTemplate(storeId, templateType, dto);
  }

  /**
   * Reset template to default
   */
  async resetTemplate(storeId: string, templateType: string) {
    return this.templateService.resetTemplate(storeId, templateType);
  }

  /**
   * Test notification
   */
  async testNotification(storeId: string, dto: TestNotificationDto) {
    const { templateType, channel, recipient } = dto;
    const variables = (dto as any).variables || {};

    // Render template with variables
    const rendered = await this.templateService.renderTemplate(
      storeId,
      templateType,
      variables,
    );

    let emailSent = false;
    let smsSent = false;

    // Send via email if requested
    if (channel === 'email' || channel === 'both') {
      if (!this.emailService.isValidEmail(recipient)) {
        throw new Error('Invalid email address');
      }

      emailSent = await this.emailService.sendEmail({
        to: recipient,
        subject: rendered.subject,
        html: rendered.htmlContent,
        text: rendered.textContent,
      });
    }

    // Send via SMS if requested
    if (channel === 'sms' || channel === 'both') {
      if (!this.smsService.isValidPhoneNumber(recipient)) {
        // Try to format the phone number
        const formatted = this.smsService.formatPhoneNumber(recipient);
        if (!this.smsService.isValidPhoneNumber(formatted)) {
          throw new Error('Invalid phone number');
        }
      }

      if (rendered.smsContent) {
        smsSent = await this.smsService.sendSMS({
          to: recipient,
          message: rendered.smsContent,
        });
      }
    }

    return {
      success: emailSent || smsSent,
      emailSent,
      smsSent,
      message: 'Test notification sent successfully',
    };
  }

  /**
   * Send appointment confirmation notification
   */
  async sendAppointmentConfirmation(
    storeId: string,
    recipientEmail: string,
    recipientPhone: string | null,
    variables: TemplateVariables,
  ) {
    const settings = await this.getSettings(storeId);

    if (!settings.appointmentConfirmationEnabled) {
      this.logger.log('Appointment confirmation notifications are disabled');
      return { sent: false, reason: 'Notifications disabled' };
    }

    return this.sendNotification(
      storeId,
      'appointment_confirmation',
      settings.appointmentConfirmationChannel || 'email',
      recipientEmail,
      recipientPhone,
      variables,
    );
  }

  /**
   * Send appointment reminder (24h)
   */
  async sendAppointmentReminder24h(
    storeId: string,
    recipientEmail: string,
    recipientPhone: string | null,
    variables: TemplateVariables,
  ) {
    const settings = await this.getSettings(storeId);

    if (!settings.appointmentReminderEnabled) {
      this.logger.log('Appointment reminders are disabled');
      return { sent: false, reason: 'Notifications disabled' };
    }

    if (!settings.reminder24hEnabled) {
      this.logger.log('24h reminder notifications are disabled');
      return { sent: false, reason: '24h reminders disabled' };
    }

    return this.sendNotification(
      storeId,
      'appointment_reminder_24h',
      settings.appointmentReminderChannel || 'email',
      recipientEmail,
      recipientPhone,
      variables,
    );
  }

  /**
   * Send appointment reminder (1h)
   */
  async sendAppointmentReminder1h(
    storeId: string,
    recipientEmail: string,
    recipientPhone: string | null,
    variables: TemplateVariables,
  ) {
    const settings = await this.getSettings(storeId);

    if (!settings.appointmentReminderEnabled) {
      this.logger.log('Appointment reminders are disabled');
      return { sent: false, reason: 'Notifications disabled' };
    }

    if (!settings.reminder1hEnabled) {
      this.logger.log('1h reminder notifications are disabled');
      return { sent: false, reason: '1h reminders disabled' };
    }

    return this.sendNotification(
      storeId,
      'appointment_reminder_1h',
      settings.appointmentReminderChannel || 'email',
      recipientEmail,
      recipientPhone,
      variables,
    );
  }

  /**
   * Send appointment cancellation notification
   */
  async sendAppointmentCancellation(
    storeId: string,
    recipientEmail: string,
    recipientPhone: string | null,
    variables: TemplateVariables,
  ) {
    const settings = await this.getSettings(storeId);

    if (!settings.appointmentCancellationEnabled) {
      this.logger.log('Cancellation notifications are disabled');
      return { sent: false, reason: 'Notifications disabled' };
    }

    return this.sendNotification(
      storeId,
      'appointment_cancelled',
      settings.appointmentCancellationChannel || 'email',
      recipientEmail,
      recipientPhone,
      variables,
    );
  }

  /**
   * Send appointment rescheduled notification
   */
  async sendAppointmentRescheduled(
    storeId: string,
    recipientEmail: string,
    recipientPhone: string | null,
    variables: TemplateVariables,
  ) {
    const settings = await this.getSettings(storeId);

    if (!settings.appointmentRescheduledEnabled) {
      this.logger.log('Rescheduled notifications are disabled');
      return { sent: false, reason: 'Notifications disabled' };
    }

    return this.sendNotification(
      storeId,
      'appointment_rescheduled',
      settings.appointmentRescheduledChannel || 'email',
      recipientEmail,
      recipientPhone,
      variables,
    );
  }

  /**
   * Send appointment feedback request
   */
  async sendAppointmentFeedback(
    storeId: string,
    recipientEmail: string,
    recipientPhone: string | null,
    variables: TemplateVariables,
    channel: 'email' | 'sms' | 'both' = 'email',
  ) {
    return this.sendNotification(
      storeId,
      'appointment_feedback',
      channel,
      recipientEmail,
      recipientPhone,
      variables,
    );
  }

  /**
   * Send coupon assigned notification
   */
  async sendCouponAssigned(
    storeId: string,
    recipientEmail: string,
    recipientPhone: string | null,
    variables: TemplateVariables,
    channel: 'email' | 'sms' | 'both' = 'both',
  ) {
    return this.sendNotification(
      storeId,
      'coupon_assigned',
      channel,
      recipientEmail,
      recipientPhone,
      variables,
    );
  }

  /**
   * Send staff invitation notification
   */
  async sendStaffInvitation(
    storeId: string,
    recipientEmail: string,
    variables: TemplateVariables,
  ) {
    const settings = await this.getSettings(storeId);

    if (!settings.staffInvitationEnabled) {
      this.logger.log('Staff invitation notifications are disabled');
      return { sent: false, reason: 'Notifications disabled' };
    }

    return this.sendNotification(
      storeId,
      'staff_invitation',
      'email', // Staff invitations are email-only
      recipientEmail,
      null,
      variables,
    );
  }

  /**
   * Generic notification sender
   */
  private async sendNotification(
    storeId: string,
    templateType: string,
    channel: string,
    recipientEmail: string,
    recipientPhone: string | null,
    variables: TemplateVariables,
  ) {
    try {
      // Render template
      const rendered = await this.templateService.renderTemplate(
        storeId,
        templateType,
        variables,
      );

      let emailSent = false;
      let smsSent = false;

      // Send email if channel includes email
      if (channel === 'email' || channel === 'both') {
        if (recipientEmail && this.emailService.isValidEmail(recipientEmail)) {
          emailSent = await this.emailService.sendEmail({
            to: recipientEmail,
            subject: rendered.subject,
            html: rendered.htmlContent,
            text: rendered.textContent,
            template: templateType,
          });
        } else {
          this.logger.warn(`Invalid email address: ${recipientEmail}`);
        }
      }

      // Send SMS if channel includes SMS
      if (channel === 'sms' || channel === 'both') {
        if (recipientPhone && rendered.smsContent) {
          const formattedPhone =
            this.smsService.formatPhoneNumber(recipientPhone);

          if (this.smsService.isValidPhoneNumber(formattedPhone)) {
            smsSent = await this.smsService.sendSMS({
              to: formattedPhone,
              message: rendered.smsContent,
            });
          } else {
            this.logger.warn(`Invalid phone number: ${recipientPhone}`);
          }
        }
      }

      return {
        sent: emailSent || smsSent,
        emailSent,
        smsSent,
      };
    } catch (error) {
      this.logger.error(`Failed to send notification: ${error.message}`, error);
      return {
        sent: false,
        error: error.message,
      };
    }
  }

  async createInAppNotification(
    userId: string,
    storeId: string,
    title: string,
    message: string,
    type: string,
    metadata?: Record<string, any>,
  ) {
    const notification = await this.repository.createNotification({
      userId,
      storeId,
      title,
      message,
      type,
      metadata,
      isRead: false,
    });

    this.notificationsGateway.sendToUser(userId, 'notification', notification);
    return notification;
  }

  async getUserNotifications(userId: string) {
    return this.repository.getUserNotifications(userId);
  }

  async getUserNotificationsPaginated(
    userId: string,
    page = 1,
    limit = 20,
    status: 'all' | 'read' | 'unread' = 'all',
  ) {
    return this.repository.getUserNotificationsPaginated(
      userId,
      page,
      limit,
      status,
    );
  }

  async markAsRead(id: string, userId: string) {
    return this.repository.markAsRead(id, userId);
  }

  async markAllAsRead(userId: string) {
    return this.repository.markAllAsRead(userId);
  }

  async deleteInAppNotificationsOlderThan(cutoff: Date) {
    return this.repository.deleteOlderThan(cutoff);
  }
}
