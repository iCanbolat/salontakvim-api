import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { eq, and } from 'drizzle-orm';
import { DRIZZLE_ORM } from '../../db/drizzle.module';
import * as schema from '../../db/schema';
import { TemplateVariables } from '../interfaces/notification.interface';

@Injectable()
export class TemplateService {
  constructor(
    @Inject(DRIZZLE_ORM)
    private readonly db: PostgresJsDatabase<typeof schema>,
  ) {}

  /**
   * Get default templates for all notification types
   */
  getDefaultTemplates() {
    return {
      appointment_confirmation: {
        name: 'Randevu Onayı',
        description: 'Yeni randevu oluşturulduğunda gönderilen bildirim',
        subject: 'Randevunuz Onaylandı - {{storeName}}',
        htmlContent: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">Merhaba {{customerName}},</h2>
            <p>Randevunuz başarıyla oluşturuldu.</p>
            
            <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="margin-top: 0;">Randevu Detayları</h3>
              <p><strong>Hizmet:</strong> {{serviceName}}</p>
              <p><strong>Tarih ve Saat:</strong> {{appointmentDateTime}}</p>
              <p><strong>Personel:</strong> {{staffName}}</p>
              <p><strong>Süre:</strong> {{duration}} dakika</p>
              <p><strong>Ücret:</strong> {{price}} TL</p>
            </div>
            
            <p>Herhangi bir değişiklik yapmak isterseniz lütfen bizimle iletişime geçin.</p>
            
            <p style="color: #666; font-size: 14px; margin-top: 30px;">
              Saygılarımızla,<br>
              {{storeName}}<br>
              {{storePhone}}<br>
              {{storeEmail}}
            </p>
          </div>
        `,
        textContent: `Merhaba {{customerName}},

Randevunuz başarıyla oluşturuldu.

Randevu Detayları:
Hizmet: {{serviceName}}
Tarih ve Saat: {{appointmentDateTime}}
Personel: {{staffName}}
Süre: {{duration}} dakika
Ücret: {{price}} TL

Herhangi bir değişiklik yapmak isterseniz lütfen bizimle iletişime geçin.

Saygılarımızla,
{{storeName}}
{{storePhone}}
{{storeEmail}}`,
        smsContent:
          '{{storeName}}: Randevunuz onaylandı. {{appointmentDateTime}} - {{serviceName}} - {{staffName}}',
        availableVariables: [
          'customerName',
          'serviceName',
          'appointmentDateTime',
          'staffName',
          'duration',
          'price',
          'storeName',
          'storePhone',
          'storeEmail',
          'storeAddress',
        ],
      },
      appointment_reminder_24h: {
        name: 'Randevu Hatırlatma (24 Saat)',
        description: 'Randevudan 24 saat önce gönderilen hatırlatma',
        subject: 'Yarın Randevunuz Var - {{storeName}}',
        htmlContent: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">Merhaba {{customerName}},</h2>
            <p>Yarın randevunuz bulunmaktadır. Sizi görmek için sabırsızlanıyoruz!</p>
            
            <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="margin-top: 0;">Randevu Detayları</h3>
              <p><strong>Hizmet:</strong> {{serviceName}}</p>
              <p><strong>Tarih ve Saat:</strong> {{appointmentDateTime}}</p>
              <p><strong>Personel:</strong> {{staffName}}</p>
            </div>
            
            <p>Randevunuzu iptal etmeniz veya değiştirmeniz gerekiyorsa lütfen en kısa sürede bize bildirin.</p>
            
            <p style="color: #666; font-size: 14px; margin-top: 30px;">
              Saygılarımızla,<br>
              {{storeName}}<br>
              {{storePhone}}
            </p>
          </div>
        `,
        textContent: `Merhaba {{customerName}},

Yarın randevunuz bulunmaktadır. Sizi görmek için sabırsızlanıyoruz!

Randevu Detayları:
Hizmet: {{serviceName}}
Tarih ve Saat: {{appointmentDateTime}}
Personel: {{staffName}}

Randevunuzu iptal etmeniz veya değiştirmeniz gerekiyorsa lütfen en kısa sürede bize bildirin.

Saygılarımızla,
{{storeName}}
{{storePhone}}`,
        smsContent:
          '{{storeName}}: Yarın randevunuz var. {{appointmentDateTime}} - {{serviceName}}',
        availableVariables: [
          'customerName',
          'serviceName',
          'appointmentDateTime',
          'staffName',
          'storeName',
          'storePhone',
        ],
      },
      appointment_reminder_1h: {
        name: 'Randevu Hatırlatma (1 Saat)',
        description: 'Randevudan 1 saat önce gönderilen hatırlatma',
        subject: '1 Saat Sonra Randevunuz - {{storeName}}',
        htmlContent: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">Merhaba {{customerName}},</h2>
            <p>1 saat sonra randevunuz bulunmaktadır.</p>
            
            <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <p><strong>Saat:</strong> {{appointmentDateTime}}</p>
              <p><strong>Hizmet:</strong> {{serviceName}}</p>
              <p><strong>Personel:</strong> {{staffName}}</p>
              <p><strong>Adres:</strong> {{storeAddress}}</p>
            </div>
            
            <p>Görüşmek üzere!</p>
            
            <p style="color: #666; font-size: 14px; margin-top: 30px;">
              {{storeName}}<br>
              {{storePhone}}
            </p>
          </div>
        `,
        textContent: `Merhaba {{customerName}},

1 saat sonra randevunuz bulunmaktadır.

Saat: {{appointmentDateTime}}
Hizmet: {{serviceName}}
Personel: {{staffName}}
Adres: {{storeAddress}}

Görüşmek üzere!

{{storeName}}
{{storePhone}}`,
        smsContent:
          '{{storeName}}: 1 saat sonra randevunuz. {{appointmentDateTime}} - {{storeAddress}}',
        availableVariables: [
          'customerName',
          'serviceName',
          'appointmentDateTime',
          'staffName',
          'storeName',
          'storePhone',
          'storeAddress',
        ],
      },
      appointment_cancelled: {
        name: 'Randevu İptali',
        description: 'Randevu iptal edildiğinde gönderilen bildirim',
        subject: 'Randevunuz İptal Edildi - {{storeName}}',
        htmlContent: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">Merhaba {{customerName}},</h2>
            <p>Randevunuz iptal edilmiştir.</p>
            
            <div style="background-color: #fff3cd; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ffc107;">
              <h3 style="margin-top: 0;">İptal Edilen Randevu</h3>
              <p><strong>Hizmet:</strong> {{serviceName}}</p>
              <p><strong>Tarih ve Saat:</strong> {{appointmentDateTime}}</p>
              <p><strong>Personel:</strong> {{staffName}}</p>
            </div>
            
            <p>Yeni bir randevu oluşturmak isterseniz lütfen bizimle iletişime geçin.</p>
            
            <p style="color: #666; font-size: 14px; margin-top: 30px;">
              {{storeName}}<br>
              {{storePhone}}<br>
              {{storeEmail}}
            </p>
          </div>
        `,
        textContent: `Merhaba {{customerName}},

Randevunuz iptal edilmiştir.

İptal Edilen Randevu:
Hizmet: {{serviceName}}
Tarih ve Saat: {{appointmentDateTime}}
Personel: {{staffName}}

Yeni bir randevu oluşturmak isterseniz lütfen bizimle iletişime geçin.

{{storeName}}
{{storePhone}}
{{storeEmail}}`,
        smsContent:
          '{{storeName}}: Randevunuz iptal edildi. {{appointmentDateTime}} - {{serviceName}}',
        availableVariables: [
          'customerName',
          'serviceName',
          'appointmentDateTime',
          'staffName',
          'storeName',
          'storePhone',
          'storeEmail',
        ],
      },
      appointment_rescheduled: {
        name: 'Randevu Değişikliği',
        description: 'Randevu tarihi değiştirildiğinde gönderilen bildirim',
        subject: 'Randevunuz Değiştirildi - {{storeName}}',
        htmlContent: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">Merhaba {{customerName}},</h2>
            <p>Randevunuz yeni bir tarihe taşınmıştır.</p>
            
            <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="margin-top: 0;">Yeni Randevu Detayları</h3>
              <p><strong>Hizmet:</strong> {{serviceName}}</p>
              <p><strong>Yeni Tarih ve Saat:</strong> {{appointmentDateTime}}</p>
              <p><strong>Personel:</strong> {{staffName}}</p>
            </div>
            
            <p>Bu değişiklik hakkında sorularınız varsa lütfen bizimle iletişime geçin.</p>
            
            <p style="color: #666; font-size: 14px; margin-top: 30px;">
              Saygılarımızla,<br>
              {{storeName}}<br>
              {{storePhone}}<br>
              {{storeEmail}}
            </p>
          </div>
        `,
        textContent: `Merhaba {{customerName}},

Randevunuz yeni bir tarihe taşınmıştır.

Yeni Randevu Detayları:
Hizmet: {{serviceName}}
Yeni Tarih ve Saat: {{appointmentDateTime}}
Personel: {{staffName}}

Bu değişiklik hakkında sorularınız varsa lütfen bizimle iletişime geçin.

Saygılarımızla,
{{storeName}}
{{storePhone}}
{{storeEmail}}`,
        smsContent:
          '{{storeName}}: Randevunuz değiştirildi. Yeni tarih: {{appointmentDateTime}}',
        availableVariables: [
          'customerName',
          'serviceName',
          'appointmentDateTime',
          'staffName',
          'storeName',
          'storePhone',
          'storeEmail',
        ],
      },
      appointment_feedback: {
        name: 'Randevu Geri Bildirim Talebi',
        description:
          'Randevu tamamlandıktan sonra geri bildirim linki gönderimi',
        subject: 'Geri Bildiriminiz Bizim İçin Önemli - {{storeName}}',
        htmlContent: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">Merhaba {{customerName}},</h2>
            <p>Randevunuz tamamlandı. Deneyiminizi değerlendirebilir misiniz?</p>
            
            <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="margin-top: 0;">Randevu Detayları</h3>
              <p><strong>Hizmet:</strong> {{serviceName}}</p>
              <p><strong>Tarih ve Saat:</strong> {{appointmentDateTime}}</p>
              <p><strong>Personel:</strong> {{staffName}}</p>
            </div>
            
            <p>Aşağıdaki butona tıklayarak kısa bir geri bildirim bırakabilirsiniz:</p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="{{feedbackLink}}" style="background-color: #0ea5e9; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
                Geri Bildirim Gönder
              </a>
            </div>
            
            <p style="color: #666; font-size: 14px; margin-top: 30px;">
              Teşekkürler,<br>
              {{storeName}}<br>
              {{storePhone}}<br>
              {{storeEmail}}
            </p>
          </div>
        `,
        textContent: `Merhaba {{customerName}},

Randevunuz tamamlandı. Deneyiminizi değerlendirebilir misiniz?

Randevu Detayları:
Hizmet: {{serviceName}}
Tarih ve Saat: {{appointmentDateTime}}
Personel: {{staffName}}

Geri bildirim linki:
{{feedbackLink}}

Teşekkürler,
{{storeName}}
{{storePhone}}
{{storeEmail}}`,
        smsContent:
          '{{storeName}}: Randevunuz tamamlandı. Geri bildirim için: {{feedbackLink}}',
        availableVariables: [
          'customerName',
          'serviceName',
          'appointmentDateTime',
          'staffName',
          'storeName',
          'storePhone',
          'storeEmail',
          'feedbackLink',
        ],
      },
      coupon_assigned: {
        name: 'Kupon Bildirimi',
        description:
          'Müşterilere indirim kuponu atandığında gönderilen bildirim',
        subject: '{{storeName}} - Size Özel İndirim Kuponu',
        htmlContent: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">Merhaba {{customerName}},</h2>
            <p>Size özel bir indirim kuponu tanımladık 🎉</p>
            
            <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="margin-top: 0;">Kupon Detayları</h3>
              <p><strong>Kod:</strong> {{couponCode}}</p>
              <p><strong>Kupon:</strong> {{couponName}}</p>
              <p><strong>İndirim:</strong> {{discountText}}</p>
              <p><strong>Geçerlilik:</strong> {{validUntil}}</p>
            </div>
            
            <p>Bir sonraki randevunuzda bu kuponu kullanmayı unutmayın.</p>
            
            <p style="color: #666; font-size: 14px; margin-top: 30px;">
              Saygılarımızla,<br>
              {{storeName}}<br>
              {{storePhone}}<br>
              {{storeEmail}}
            </p>
          </div>
        `,
        textContent: `Merhaba {{customerName}},

Size özel bir indirim kuponu tanımladık.

Kupon Detayları:
Kod: {{couponCode}}
Kupon: {{couponName}}
İndirim: {{discountText}}
Geçerlilik: {{validUntil}}

Bir sonraki randevunuzda bu kuponu kullanmayı unutmayın.

Saygılarımızla,
{{storeName}}
{{storePhone}}
{{storeEmail}}`,
        smsContent:
          '{{storeName}}: Size özel kupon tanımlandı. Kod: {{couponCode}} ({{discountText}}) Son: {{validUntil}}',
        availableVariables: [
          'customerName',
          'couponCode',
          'couponName',
          'discountText',
          'validUntil',
          'storeName',
          'storePhone',
          'storeEmail',
        ],
      },
      staff_invitation: {
        name: 'Personel Daveti',
        description: 'Yeni personel davet edildiğinde gönderilen bildirim',
        subject: '{{storeName}} Ekibine Katılın',
        htmlContent: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">Merhaba {{staffName}},</h2>
            <p><strong>{{storeName}}</strong> ekibine katılmak için davet edildiniz!</p>
            
            <div style="background-color: #e3f2fd; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #2196f3;">
              <h3 style="margin-top: 0;">Davet Detayları</h3>
              <p><strong>Rol:</strong> {{role}}</p>
              <p><strong>Salon:</strong> {{storeName}}</p>
              <p><strong>Pozisyon:</strong> {{title}}</p>
              <p><strong>Lokasyon:</strong> {{locationName}}</p>
            </div>
            
            <p>Hesabınızı aktifleştirmek için aşağıdaki linke tıklayın:</p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="{{invitationLink}}" style="background-color: #2196f3; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
                Hesabı Aktifleştir
              </a>
            </div>
            
            <p style="color: #666; font-size: 14px;">Bu link 7 gün içinde geçerliliğini yitirecektir.</p>
            
            <p style="color: #666; font-size: 14px; margin-top: 30px;">
              {{storeName}}<br>
              {{storeEmail}}
            </p>
          </div>
        `,
        textContent: `Merhaba {{staffName}},

{{storeName}} ekibine katılmak için davet edildiniz!

Davet Detayları:
Rol: {{role}}
Salon: {{storeName}}
Pozisyon: {{title}}
Lokasyon: {{locationName}}

Hesabınızı aktifleştirmek için aşağıdaki linke tıklayın:
{{invitationLink}}

Bu link 7 gün içinde geçerliliğini yitirecektir.

{{storeName}}
{{storeEmail}}`,
        smsContent:
          '{{storeName}}: Personel davetiniz için: {{invitationLink}}',
        availableVariables: [
          'staffName',
          'storeName',
          'storeEmail',
          'role',
          'title',
          'locationName',
          'invitationLink',
        ],
      },
      password_reset: {
        name: 'Şifre Sıfırlama',
        description: 'Şifre sıfırlama talebi yapıldığında gönderilen bildirim',
        subject: 'Şifre Sıfırlama Talebi',
        htmlContent: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">Merhaba {{userName}},</h2>
            <p>Şifrenizi sıfırlamak için bir talepte bulundunuz.</p>
            
            <p>Şifrenizi sıfırlamak için aşağıdaki linke tıklayın:</p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="{{resetLink}}" style="background-color: #f44336; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
                Şifremi Sıfırla
              </a>
            </div>
            
            <p style="color: #666; font-size: 14px;">Bu link 1 saat içinde geçerliliğini yitirecektir.</p>
            
            <p style="color: #ff5722; font-weight: bold;">Eğer bu talebi siz yapmadıysanız, bu e-postayı görmezden gelin.</p>
            
            <p style="color: #666; font-size: 14px; margin-top: 30px;">
              SalonTakvim
            </p>
          </div>
        `,
        textContent: `Merhaba {{userName}},

Şifrenizi sıfırlamak için bir talepte bulundunuz.

Şifrenizi sıfırlamak için aşağıdaki linke tıklayın:
{{resetLink}}

Bu link 1 saat içinde geçerliliğini yitirecektir.

Eğer bu talebi siz yapmadıysanız, bu e-postayı görmezden gelin.

SalonTakvim`,
        smsContent: 'Şifre sıfırlama linki: {{resetLink}} (1 saat geçerli)',
        availableVariables: ['userName', 'resetLink'],
      },
    };
  }

  /**
   * Get template by type for a store
   */
  async getTemplate(storeId: string, templateType: string) {
    // Try to get custom template
    const customTemplate = await this.db.query.notificationTemplates.findFirst({
      where: and(
        eq(schema.notificationTemplates.storeId, storeId),
        eq(schema.notificationTemplates.type, templateType as any),
      ),
    });

    if (customTemplate) {
      return customTemplate;
    }

    // Return default template
    const defaultTemplates = this.getDefaultTemplates();
    const defaultTemplate = defaultTemplates[templateType];

    if (!defaultTemplate) {
      throw new NotFoundException(
        `Template not found for type: ${templateType}`,
      );
    }

    return {
      type: templateType,
      isCustom: false,
      ...defaultTemplate,
    };
  }

  /**
   * Replace variables in template content
   */
  replaceVariables(content: string, variables: TemplateVariables): string {
    let result = content;

    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`{{${key}}}`, 'g');
      result = result.replace(regex, String(value || ''));
    }

    return result;
  }

  /**
   * Render template with variables
   */
  async renderTemplate(
    storeId: string,
    templateType: string,
    variables: TemplateVariables,
  ) {
    const template = await this.getTemplate(storeId, templateType);

    return {
      subject: this.replaceVariables(template.subject, variables),
      htmlContent: template.htmlContent
        ? this.replaceVariables(template.htmlContent, variables)
        : undefined,
      textContent: template.textContent
        ? this.replaceVariables(template.textContent, variables)
        : undefined,
      smsContent: template.smsContent
        ? this.replaceVariables(template.smsContent, variables)
        : undefined,
    };
  }

  /**
   * Get all templates for a store (custom + defaults)
   */
  async getAllTemplates(storeId: string) {
    const customTemplates = await this.db.query.notificationTemplates.findMany({
      where: eq(schema.notificationTemplates.storeId, storeId),
    });

    const defaultTemplates = this.getDefaultTemplates();
    const customTemplateTypes = new Set(customTemplates.map((t) => t.type));

    // Combine custom and default templates
    const allTemplates: any[] = [];

    // Add custom templates
    for (const custom of customTemplates) {
      allTemplates.push({
        ...custom,
        isCustom: true,
      });
    }

    // Add default templates that don't have custom versions
    for (const [type, template] of Object.entries(defaultTemplates)) {
      if (!customTemplateTypes.has(type as any)) {
        allTemplates.push({
          type,
          isCustom: false,
          ...template,
        });
      }
    }

    return allTemplates;
  }

  /**
   * Update or create custom template
   */
  async updateTemplate(
    storeId: string,
    templateType: string,
    data: Partial<typeof schema.notificationTemplates.$inferInsert>,
  ) {
    const existing = await this.db.query.notificationTemplates.findFirst({
      where: and(
        eq(schema.notificationTemplates.storeId, storeId),
        eq(schema.notificationTemplates.type, templateType as any),
      ),
    });

    if (existing) {
      // Update existing
      await this.db
        .update(schema.notificationTemplates)
        .set({
          ...data,
          updatedAt: new Date(),
        })
        .where(eq(schema.notificationTemplates.id, existing.id));

      return this.getTemplate(storeId, templateType);
    } else {
      // Create new custom template
      const defaultTemplate = this.getDefaultTemplates()[templateType];
      if (!defaultTemplate) {
        throw new NotFoundException(
          `Template not found for type: ${templateType}`,
        );
      }

      await this.db.insert(schema.notificationTemplates).values({
        storeId,
        type: templateType as any,
        name: data.name || defaultTemplate.name,
        description: data.description || defaultTemplate.description,
        subject: data.subject || defaultTemplate.subject,
        htmlContent: data.htmlContent || defaultTemplate.htmlContent,
        textContent: data.textContent || defaultTemplate.textContent,
        smsContent: data.smsContent || defaultTemplate.smsContent,
        availableVariables:
          data.availableVariables || defaultTemplate.availableVariables,
        isCustom: true,
      });

      return this.getTemplate(storeId, templateType);
    }
  }

  /**
   * Reset template to default
   */
  async resetTemplate(storeId: string, templateType: string) {
    await this.db
      .delete(schema.notificationTemplates)
      .where(
        and(
          eq(schema.notificationTemplates.storeId, storeId),
          eq(schema.notificationTemplates.type, templateType as any),
        ),
      );

    return this.getTemplate(storeId, templateType);
  }
}
