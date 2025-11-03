# Notifications Module Documentation

## 📧 Overview

The Notifications Module provides a comprehensive email and SMS notification system for appointment-related events. It supports multiple providers, customizable templates, and flexible channel configuration per notification type.

**Status**: ✅ Complete  
**Endpoints**: 7  
**Templates**: 7 default templates (Turkish)  
**Channels**: Email, SMS, Both

---

## 🎯 Features

### Core Features

- ✅ **Multi-Channel Support**: Email, SMS, or both
- ✅ **Multi-Provider Support**:
  - Email: SendGrid, AWS SES, SMTP
  - SMS: Twilio, AWS SNS
- ✅ **Template Management**: 7 pre-built professional templates
- ✅ **Template Customization**: Store-specific template overrides
- ✅ **Variable Substitution**: Dynamic content with `{{variable}}` syntax
- ✅ **Per-Notification Settings**: Individual enable/disable and channel selection
- ✅ **Test Notifications**: Send test emails/SMS before going live
- ✅ **Automatic Defaults**: Settings created automatically for new stores

### Notification Types

1. **Appointment Confirmation** (`appointment_confirmation`)
   - Sent when a new appointment is created
   - Includes: Service, date/time, staff, duration, price

2. **24-Hour Reminder** (`appointment_reminder_24h`)
   - Sent 24 hours before appointment
   - Includes: Service, date/time, staff, location

3. **1-Hour Reminder** (`appointment_reminder_1h`)
   - Sent 1 hour before appointment
   - Includes: Service, date/time, staff, address

4. **Appointment Cancelled** (`appointment_cancelled`)
   - Sent when appointment is cancelled
   - Includes: Cancelled appointment details

5. **Appointment Rescheduled** (`appointment_rescheduled`)
   - Sent when appointment date/time changes
   - Includes: New date/time and service details

6. **Staff Invitation** (`staff_invitation`)
   - Sent when inviting new staff members
   - Includes: Invitation link, store name, role

7. **Password Reset** (`password_reset`)
   - Sent when user requests password reset
   - Includes: Reset link (1-hour expiration)

---

## 📂 Project Structure

```
src/notifications/
├── dto/
│   ├── notification-settings.dto.ts          # Settings DTOs
│   ├── notification-settings-response.dto.ts # Settings response
│   ├── notification-template.dto.ts          # Template DTOs
│   ├── notification-template-response.dto.ts # Template response
│   └── index.ts                              # Barrel exports
├── services/
│   ├── notification.service.ts               # Main notification service
│   ├── email.service.ts                      # Email provider abstraction
│   ├── sms.service.ts                        # SMS provider abstraction
│   └── template.service.ts                   # Template management
├── repositories/
│   └── notification.repository.ts            # Database operations
├── interfaces/
│   └── notification.interface.ts             # Type definitions
├── notifications.controller.ts               # REST API endpoints
└── notifications.module.ts                   # Module definition
```

---

## 🔌 API Endpoints

### 1. Get Notification Settings

**Endpoint**: `GET /stores/:storeId/notifications/settings`  
**Auth**: Admin/Owner only  
**Description**: Retrieve current notification settings for a store

**Response Example**:

```json
{
  "id": 1,
  "storeId": 1,
  "appointmentConfirmationEnabled": true,
  "appointmentConfirmationChannel": "email",
  "appointmentReminderEnabled": true,
  "appointmentReminderChannel": "email",
  "reminder24hEnabled": true,
  "reminder1hEnabled": false,
  "appointmentCancellationEnabled": true,
  "appointmentCancellationChannel": "email",
  "appointmentRescheduledEnabled": true,
  "appointmentRescheduledChannel": "email",
  "staffInvitationEnabled": true,
  "senderEmail": "noreply@yourstore.com",
  "senderName": "Your Store Name",
  "replyToEmail": "support@yourstore.com",
  "emailProvider": "smtp",
  "smsProvider": "twilio",
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

---

### 2. Update Notification Settings

**Endpoint**: `PATCH /stores/:storeId/notifications/settings`  
**Auth**: Admin/Owner only  
**Description**: Update notification settings

**Request Body Example**:

```json
{
  "appointmentConfirmationEnabled": true,
  "appointmentConfirmationChannel": "both",
  "reminder24hEnabled": true,
  "reminder1hEnabled": true,
  "appointmentReminderChannel": "sms",
  "senderEmail": "bookings@mysalon.com",
  "senderName": "My Salon",
  "emailProvider": "sendgrid"
}
```

**Available Channels**: `"email"`, `"sms"`, `"both"`  
**Email Providers**: `"sendgrid"`, `"aws-ses"`, `"smtp"`  
**SMS Providers**: `"twilio"`, `"aws-sns"`

---

### 3. List All Templates

**Endpoint**: `GET /stores/:storeId/notifications/templates`  
**Auth**: Admin/Owner only  
**Description**: Get all notification templates (custom + default)

**Response Example**:

```json
[
  {
    "type": "appointment_confirmation",
    "name": "Randevu Onayı",
    "description": "Yeni randevu oluşturulduğunda gönderilen bildirim",
    "subject": "Randevunuz Onaylandı - {{storeName}}",
    "htmlContent": "<html>...</html>",
    "textContent": "Plain text version...",
    "smsContent": "{{storeName}}: Randevunuz onaylandı...",
    "availableVariables": [
      "customerName",
      "serviceName",
      "appointmentDateTime",
      "staffName",
      "duration",
      "price",
      "storeName",
      "storePhone",
      "storeEmail"
    ],
    "isCustom": false
  }
  // ... other templates
]
```

---

### 4. Get Specific Template

**Endpoint**: `GET /stores/:storeId/notifications/templates/:type`  
**Auth**: Admin/Owner only  
**Description**: Get a specific template by type

**Template Types**:

- `appointment_confirmation`
- `appointment_reminder_24h`
- `appointment_reminder_1h`
- `appointment_cancelled`
- `appointment_rescheduled`
- `staff_invitation`
- `password_reset`

---

### 5. Update Template

**Endpoint**: `PATCH /stores/:storeId/notifications/templates/:type`  
**Auth**: Admin/Owner only  
**Description**: Customize a template for your store

**Request Body Example**:

```json
{
  "subject": "Yeni Randevunuz - {{storeName}}",
  "htmlContent": "<html><body><h1>Merhaba {{customerName}}</h1>...</body></html>",
  "textContent": "Merhaba {{customerName}}, randevunuz oluşturuldu...",
  "smsContent": "{{storeName}}: {{appointmentDateTime}} randevunuz onaylandı"
}
```

**Note**: Only provide fields you want to update. Omitted fields will keep default values.

---

### 6. Reset Template to Default

**Endpoint**: `POST /stores/:storeId/notifications/templates/:type/reset`  
**Auth**: Admin/Owner only  
**Description**: Reset a customized template back to default

**Response**: Returns the default template

---

### 7. Send Test Notification

**Endpoint**: `POST /stores/:storeId/notifications/test`  
**Auth**: Admin/Owner only  
**Description**: Send a test notification to verify setup

**Request Body Example**:

```json
{
  "templateType": "appointment_confirmation",
  "channel": "email",
  "recipient": "test@example.com",
  "variables": {
    "customerName": "Ahmet Yılmaz",
    "serviceName": "Saç Kesimi",
    "appointmentDateTime": "15 Ocak 2024 14:00",
    "staffName": "Ayşe Demir",
    "duration": "30",
    "price": "150",
    "storeName": "Güzellik Salonu",
    "storePhone": "+90 555 123 4567",
    "storeEmail": "info@salon.com"
  }
}
```

**Response Example**:

```json
{
  "success": true,
  "emailSent": true,
  "smsSent": false,
  "message": "Test notification sent successfully"
}
```

**For SMS Testing**:

```json
{
  "templateType": "appointment_reminder_1h",
  "channel": "sms",
  "recipient": "+905551234567"
}
```

---

## 🎨 Template Variables

Each template has access to specific variables:

### Appointment Templates

- `customerName` - Customer's full name
- `serviceName` - Name of the booked service
- `appointmentDateTime` - Formatted date and time
- `staffName` - Assigned staff member's name
- `duration` - Service duration in minutes
- `price` - Service price
- `storeName` - Store/salon name
- `storePhone` - Store contact phone
- `storeEmail` - Store contact email
- `storeAddress` - Store physical address

### Staff Invitation Template

- `staffName` - Invited staff member's name
- `storeName` - Store name
- `storeEmail` - Store email
- `role` - Assigned role
- `invitationLink` - Activation link (7-day expiration)

### Password Reset Template

- `userName` - User's name
- `resetLink` - Password reset link (1-hour expiration)

---

## 🔧 Integration Guide

### Email Provider Setup

#### SendGrid

```typescript
// .env
SENDGRID_API_KEY = your_sendgrid_api_key;
EMAIL_PROVIDER = sendgrid;
```

Install package:

```bash
pnpm add @sendgrid/mail
```

#### AWS SES

```typescript
// .env
AWS_REGION = us - east - 1;
AWS_ACCESS_KEY_ID = your_access_key;
AWS_SECRET_ACCESS_KEY = your_secret_key;
EMAIL_PROVIDER = aws - ses;
```

Install package:

```bash
pnpm add @aws-sdk/client-ses
```

#### SMTP

```typescript
// .env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password
EMAIL_PROVIDER=smtp
```

Install package:

```bash
pnpm add nodemailer
```

---

### SMS Provider Setup

#### Twilio

```typescript
// .env
TWILIO_ACCOUNT_SID = your_account_sid;
TWILIO_AUTH_TOKEN = your_auth_token;
TWILIO_PHONE_NUMBER = +1234567890;
SMS_PROVIDER = twilio;
```

Install package:

```bash
pnpm add twilio
```

#### AWS SNS

```typescript
// .env
AWS_REGION = us - east - 1;
AWS_ACCESS_KEY_ID = your_access_key;
AWS_SECRET_ACCESS_KEY = your_secret_key;
SMS_PROVIDER = aws - sns;
```

Install package:

```bash
pnpm add @aws-sdk/client-sns
```

---

## 💻 Usage in Code

### Sending Notifications from Other Modules

```typescript
import { NotificationService } from '../notifications/services/notification.service';

@Injectable()
export class AppointmentsService {
  constructor(private readonly notificationService: NotificationService) {}

  async createAppointment(data: CreateAppointmentDto) {
    // Create appointment logic...

    // Send confirmation notification
    await this.notificationService.sendAppointmentConfirmation(
      storeId,
      customer.email,
      customer.phone,
      {
        customerName: customer.name,
        serviceName: service.name,
        appointmentDateTime: formatDateTime(appointment.startTime),
        staffName: staff.name,
        duration: service.duration.toString(),
        price: service.price.toString(),
        storeName: store.name,
        storePhone: store.phone,
        storeEmail: store.email,
      },
    );
  }
}
```

### Available Notification Methods

```typescript
// Appointment confirmation
notificationService.sendAppointmentConfirmation(
  storeId,
  email,
  phone,
  variables,
);

// 24h reminder
notificationService.sendAppointmentReminder24h(
  storeId,
  email,
  phone,
  variables,
);

// 1h reminder
notificationService.sendAppointmentReminder1h(storeId, email, phone, variables);

// Cancellation
notificationService.sendAppointmentCancellation(
  storeId,
  email,
  phone,
  variables,
);

// Rescheduled
notificationService.sendAppointmentRescheduled(
  storeId,
  email,
  phone,
  variables,
);

// Staff invitation
notificationService.sendStaffInvitation(storeId, email, variables);
```

---

## 🎯 Default Settings

When a store is created, default notification settings are automatically applied:

```typescript
{
  appointmentConfirmationEnabled: true,
  appointmentConfirmationChannel: 'email',
  appointmentReminderEnabled: true,
  appointmentReminderChannel: 'email',
  reminder24hEnabled: true,
  reminder1hEnabled: false,
  appointmentCancellationEnabled: true,
  appointmentCancellationChannel: 'email',
  appointmentRescheduledEnabled: true,
  appointmentRescheduledChannel: 'email',
  staffInvitationEnabled: true,
  emailProvider: 'smtp',
  smsProvider: null,
}
```

---

## 📧 Default Templates

All 7 templates are professionally designed in Turkish with:

- ✅ HTML version (styled with inline CSS)
- ✅ Plain text version (for email clients that don't support HTML)
- ✅ SMS version (concise, under 160 characters)
- ✅ Professional design matching salon/beauty business aesthetic
- ✅ Clear call-to-action buttons
- ✅ Complete business information in footer
- ✅ Responsive design (mobile-friendly)

**Template Design Highlights**:

- Clean, modern layout
- Salon-friendly color scheme
- Important info highlighted in colored boxes
- Clear typography hierarchy
- Contact information prominently displayed
- Action buttons with proper styling

---

## 🔐 Security & Permissions

- All endpoints require authentication
- Only Admin/Owner roles can access notification settings
- Store ownership is verified for all operations
- Template customizations are store-scoped (cannot affect other stores)
- Test notifications require valid email/phone format
- Sensitive provider credentials stored securely in environment variables

---

## 🧪 Testing

### Test Notification Flow

1. Configure notification settings via API
2. Set up email/SMS provider credentials in `.env`
3. Use test endpoint to verify setup:

```bash
curl -X POST http://localhost:8080/api/stores/1/notifications/test \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "templateType": "appointment_confirmation",
    "channel": "email",
    "recipient": "your-email@example.com"
  }'
```

4. Check your inbox/phone for test notification
5. Customize templates if needed
6. Test again to verify customizations

---

## 🚀 Production Checklist

Before going live:

- [ ] Configure production email provider (SendGrid/AWS SES)
- [ ] Set up production SMS provider (Twilio/AWS SNS)
- [ ] Add production credentials to environment variables
- [ ] Test all 7 notification types
- [ ] Customize templates with your branding
- [ ] Configure sender email/name
- [ ] Set up reply-to email address
- [ ] Test multi-channel notifications (email + SMS)
- [ ] Verify phone number formatting
- [ ] Set reminder timing preferences (24h/1h)
- [ ] Train staff on notification settings

---

## 📊 Database Schema

### `notification_settings` Table

```sql
- id (serial, primary key)
- store_id (integer, unique, FK to stores)
- appointment_confirmation_enabled (boolean)
- appointment_confirmation_channel (enum: email/sms/both)
- appointment_reminder_enabled (boolean)
- appointment_reminder_channel (enum: email/sms/both)
- reminder_24h_enabled (boolean)
- reminder_1h_enabled (boolean)
- appointment_cancellation_enabled (boolean)
- appointment_cancellation_channel (enum: email/sms/both)
- appointment_rescheduled_enabled (boolean)
- appointment_rescheduled_channel (enum: email/sms/both)
- staff_invitation_enabled (boolean)
- sender_email (varchar)
- sender_name (varchar)
- reply_to_email (varchar)
- email_provider (varchar: sendgrid/aws-ses/smtp)
- sms_provider (varchar: twilio/aws-sns)
- created_at (timestamp)
- updated_at (timestamp)
```

### `notification_templates` Table

```sql
- id (serial, primary key)
- store_id (integer, FK to stores)
- type (enum: 7 notification types)
- name (varchar)
- description (text)
- subject (varchar)
- html_content (text)
- text_content (text)
- sms_content (text)
- available_variables (json array)
- is_custom (boolean)
- created_at (timestamp)
- updated_at (timestamp)
- UNIQUE constraint on (store_id, type)
```

---

## 🔮 Future Enhancements

Potential improvements for future versions:

- [ ] Template preview in admin panel
- [ ] A/B testing for notification templates
- [ ] Notification delivery analytics
- [ ] Click tracking for email links
- [ ] Unsubscribe management
- [ ] Notification scheduling
- [ ] Batch notification sending
- [ ] WhatsApp integration
- [ ] Push notification support
- [ ] Multi-language templates
- [ ] Rich text editor for template customization
- [ ] Template gallery/marketplace

---

## 📞 Support

For questions or issues:

- Check API documentation: `/api/docs`
- Review code examples in this file
- Test with test endpoint before production
- Verify provider credentials if notifications fail
- Check application logs for detailed error messages

---

## ✨ Summary

The Notifications Module provides a complete, production-ready notification system with:

- ✅ 7 endpoints for full control
- ✅ 7 professional default templates
- ✅ Multi-channel support (email/SMS)
- ✅ Multiple provider integrations
- ✅ Store-specific customization
- ✅ Easy testing and debugging
- ✅ Comprehensive documentation

**Perfect for salon/spa booking systems** with appointment reminders, confirmations, and staff management! 💇‍♀️✨
