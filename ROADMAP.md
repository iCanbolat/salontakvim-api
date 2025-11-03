# SalonTakvim API - Development Roadmap

## 📋 Project Overview

Multi-tenant SaaS booking/appointment application for salons and service businesses.

**Overall Progress**: ~90% Complete (8 modules completed out of 15 planned)

## ✅ Completed Modules (8/15)

### Phase 1: Core Business Entities (100% Complete)

1. **Authentication Module** - JWT, refresh tokens, RBAC
2. **Stores Module** - Multi-tenant store management (8 endpoints)
3. **Categories Module** - Service categories with ordering (6 endpoints)
4. **Locations Module** - Business locations management (6 endpoints)
5. **Services Module** - Services & extras CRUD (13 endpoints)

### Phase 2: Staff Management (100% Complete)

6. **Staff Module** - Invitations, working hours, breaks (25 endpoints)

### Phase 3: Appointment System (100% Complete)

7. **Appointments Module** - Booking system with availability (14 endpoints)

### Phase 4: Widget & Public Booking (100% Complete)

8. **Widget Module** - Embeddable booking widget (9 endpoints)

---

## ✅ Completed Modules Details

### 1. Authentication Module (DONE)

- [x] Local authentication (email/password)
- [x] JWT token management
- [x] Refresh token mechanism
- [x] Role-based access control (Admin, Staff, Customer)
- [x] Guards and decorators
- [x] User repository and service

---

## 🚀 Development Phases

## Phase 1: Core Business Entities (Foundation)

### 2. Stores Module (Priority: HIGH)

**Purpose**: Multi-tenant store management - each admin owns a store

**Features**:

- [x] Create store (auto-created on admin registration)
- [x] Get store details
- [x] Update store information (name, description, logo, contact)
- [x] Store settings management
- [x] Store analytics (total appointments, customers)
- [x] Slug-based store identification
- [x] Store activation/deactivation

**Endpoints**:

```
POST   /stores                    - Create store ✅
GET    /stores/my-store           - Get my store ✅
GET    /stores/:id                - Get store by ID ✅
GET    /stores/slug/:slug         - Get store by slug ✅
PATCH  /stores/:id                - Update store ✅
DELETE /stores/:id/deactivate     - Deactivate store ✅
DELETE /stores/:id                - Delete store ✅
GET    /stores/:id/analytics      - Get store statistics ✅
```

**Guards**: Only store owner (admin) can manage their store ✅

**Implementation Details**:

- ✅ DTOs: CreateStoreDto, UpdateStoreDto, StoreResponseDto
- ✅ Repository pattern with Drizzle ORM
- ✅ Service layer with business logic
- ✅ Controller with role-based guards
- ✅ Store ownership verification
- ✅ Slug uniqueness validation
- ✅ One store per admin constraint

---

### 3. Categories Module (Priority: HIGH)

**Purpose**: Service categorization for better organization

**Features**:

- [x] CRUD operations for categories
- [x] Category positioning/ordering
- [x] Color and icon customization
- [x] Visibility toggle
- [x] Store-scoped categories

**Endpoints**:

```
POST   /stores/:storeId/categories           - Create category ✅
GET    /stores/:storeId/categories           - List categories ✅
GET    /stores/:storeId/categories/:id       - Get category ✅
PATCH  /stores/:storeId/categories/:id       - Update category ✅
DELETE /stores/:storeId/categories/:id       - Delete category ✅
PATCH  /stores/:storeId/categories           - Reorder categories ✅
```

**Guards**: Admin/Staff only for their store ✅

**Implementation Details**:

- ✅ DTOs: CreateCategoryDto, UpdateCategoryDto, CategoryResponseDto, ReorderCategoriesDto
- ✅ Repository with transaction support for reordering
- ✅ Service layer with store ownership validation
- ✅ Controller with nested routing under stores
- ✅ Auto-positioning for new categories
- ✅ Hex color validation
- ✅ Batch reorder with transaction

---

### 4. Locations Module (Priority: MEDIUM)

**Purpose**: Multi-location/branch management

**Features**:

- [x] CRUD operations for locations
- [x] Address and contact information
- [x] Geo-coordinates for map integration
- [x] Location visibility toggle
- [x] Store-scoped locations

**Endpoints**:

```
POST   /stores/:storeId/locations         - Create location ✅
GET    /stores/:storeId/locations         - List locations ✅
GET    /stores/:storeId/locations/visible - List visible locations (Public) ✅
GET    /stores/:storeId/locations/:id     - Get location ✅
PATCH  /stores/:storeId/locations/:id     - Update location ✅
DELETE /stores/:storeId/locations/:id     - Delete location ✅
```

**Guards**: Admin/Staff only for their store, Public endpoint for visible locations ✅

**Implementation Details**:

- ✅ DTOs: CreateLocationDto, UpdateLocationDto, LocationResponseDto
- ✅ Repository with visibility filtering
- ✅ Service layer with store ownership validation
- ✅ Controller with nested routing and public endpoint
- ✅ Geo-coordinate support (latitude/longitude)
- ✅ Complete address fields (city, state, zip, country)
- ✅ Helper method for location validation in other modules

---

### 5. Services Module (Priority: HIGH)

**Purpose**: Core service offerings management

**Features**:

- [x] CRUD operations for services
- [x] Service pricing and duration
- [x] Category assignment
- [x] Capacity management (how many people per appointment)
- [x] Buffer time before/after service
- [x] Service extras/add-ons management
- [x] Image upload support
- [x] Service positioning
- [x] Visibility toggle
- [x] Recurring appointment support flag
- [x] "Bringing anyone" option flag

**Endpoints**:

```
POST   /stores/:storeId/services                     - Create service ✅
GET    /stores/:storeId/services                     - List services ✅
GET    /stores/:storeId/services/visible             - List visible services (Public) ✅
GET    /stores/:storeId/services/:id                 - Get service ✅
PATCH  /stores/:storeId/services/:id                 - Update service ✅
DELETE /stores/:storeId/services/:id                 - Delete service ✅
POST   /stores/:storeId/services/:id/extras          - Add extra ✅
GET    /stores/:storeId/services/:id/extras          - List extras ✅
PATCH  /stores/:storeId/services/:id/extras/:extraId - Update extra ✅
DELETE /stores/:storeId/services/:id/extras/:extraId - Delete extra ✅
```

**Guards**: Admin/Staff only for their store, Public endpoint for visible services ✅

**Implementation Details**:

- ✅ DTOs: CreateServiceDto, UpdateServiceDto, ServiceResponseDto
- ✅ Extra DTOs: CreateServiceExtraDto, UpdateServiceExtraDto, ServiceExtraResponseDto
- ✅ Dual repositories: ServiceRepository + ServiceExtraRepository
- ✅ Service layer with category validation
- ✅ Controller with nested extras endpoints
- ✅ Auto-positioning for services and extras
- ✅ Decimal price handling
- ✅ Buffer time management
- ✅ Capacity and duration tracking
- ✅ Helper method for service validation in other modules

---

## Phase 2: Staff Management

### 6. Staff Module (Priority: HIGH)

**Purpose**: Staff/employee management and assignments

**Features**:

- [x] Staff invitation system (email invite with token)
- [x] Staff profile management
- [x] Service-staff assignments (which staff can perform which services)
- [x] Location-staff assignments
- [x] Staff working hours management
- [x] Staff breaks/time-off management
- [x] Staff visibility toggle

**Endpoints**:

```
# Staff Invitations
POST   /stores/:storeId/staff/invite              - Send staff invitation ✅
GET    /stores/:storeId/staff/invitations         - List invitations ✅
POST   /staff/invitations/:token/accept           - Accept invitation (public) ✅
DELETE /stores/:storeId/staff/invitations/:id     - Cancel invitation ✅

# Staff Management
GET    /stores/:storeId/staff                     - List staff members ✅
GET    /stores/:storeId/staff/:id                 - Get staff member ✅
PATCH  /stores/:storeId/staff/:id                 - Update staff profile ✅
DELETE /stores/:storeId/staff/:id                 - Remove staff member ✅

# Staff Services
POST   /stores/:storeId/staff/:id/services        - Assign services to staff ✅
GET    /stores/:storeId/staff/:id/services        - Get staff services ✅
DELETE /stores/:storeId/staff/:id/services/:serviceId - Remove service assignment ✅

# Staff Working Hours
POST   /stores/:storeId/staff/:id/working-hours   - Set working hours ✅
GET    /stores/:storeId/staff/:id/working-hours   - Get working hours ✅
PATCH  /stores/:storeId/staff/:id/working-hours/:hourId - Update working hour ✅
DELETE /stores/:storeId/staff/:id/working-hours/:hourId - Delete working hour ✅

# Staff Breaks/Time Off
POST   /stores/:storeId/staff/:id/breaks          - Create break/time-off ✅
GET    /stores/:storeId/staff/:id/breaks          - List breaks ✅
PATCH  /stores/:storeId/staff/:id/breaks/:breakId - Update break ✅
DELETE /stores/:storeId/staff/:id/breaks/:breakId - Delete break ✅
```

**Special Logic**:

- Invitation system with expiration ✅
- Email notifications for invitations (TODO: Email service)
- Staff user creation on acceptance ✅
- Automatic role assignment (staff role) ✅
- Overlap detection for breaks/time-off ✅
- Date validation for breaks ✅
- Service assignment validation

**Guards**: Admin only for management, Staff can view/update own profile ✅

**Implementation Details**:

- ✅ DTOs: InviteStaffDto, UpdateStaffProfileDto, StaffMemberResponseDto, StaffInvitationResponseDto
- ✅ Working Hours DTOs: CreateWorkingHoursDto, UpdateWorkingHoursDto, WorkingHoursResponseDto
- ✅ Breaks DTOs: CreateStaffBreakDto, UpdateStaffBreakDto, StaffBreakResponseDto
- ✅ Services DTOs: AssignServicesDto
- ✅ Repositories: StaffMemberRepository, StaffInvitationRepository, StaffWorkingHoursRepository, StaffBreakRepository, ServiceStaffRepository
- ✅ Repository interfaces with type safety
- ✅ Service layer with complex business logic:
  - Invitation generation with 7-day expiration
  - Duplicate invitation prevention
  - Staff user auto-creation on acceptance
  - Overlap detection for breaks
  - Working hours management
  - Service assignment with batch operations
- ✅ Controller with 25 endpoints covering all features
- ✅ Module registration in AppModule
- ✅ Exports for cross-module usage

---

## Phase 3: Appointment System (Core Feature)

### 7. Appointments Module (Priority: CRITICAL)

**Purpose**: Core booking and appointment management

**Features**:

- [x] Create appointment (authenticated user)
- [x] Create appointment (guest user)
- [x] Get available time slots
- [x] List appointments (with filters)
- [x] Update appointment
- [x] Cancel appointment
- [x] Appointment status management (pending, confirmed, cancelled, completed, no_show)
- [x] Payment tracking
- [ ] Recurring appointments (TODO)
- [x] Customer notes and internal notes
- [x] Appointment extras selection
- [x] Number of people selection
- [ ] Custom field values (Requires Custom Fields Module)

**Endpoints**:

```
# Availability
GET    /stores/:storeId/availability              - Get available time slots ✅

# Appointments (Customer)
POST   /stores/:storeId/appointments              - Create appointment ✅
GET    /appointments                              - List my appointments ✅
GET    /appointments/:id                          - Get appointment details ✅
PATCH  /appointments/:id                          - Update appointment ✅
DELETE /appointments/:id                          - Cancel appointment ✅

# Appointments (Staff/Admin)
GET    /stores/:storeId/appointments              - List store appointments ✅
GET    /stores/:storeId/appointments/:id          - Get appointment ✅
PATCH  /stores/:storeId/appointments/:id/status   - Update status ✅
PATCH  /stores/:storeId/appointments/:id          - Update appointment ✅

# Guest Appointments (Public)
POST   /public/stores/:slug/appointments          - Create guest appointment ✅
```

**Complex Logic**:

- Time slot availability calculation considering: ✅
  - Staff working hours ✅
  - Staff breaks/time-off ✅
  - Existing appointments ✅
  - Service duration + buffer times ✅
  - Location capacity (TODO)
  - Service capacity (TODO)
- Conflict detection ✅
- Overlapping appointment prevention ✅
- Recurring appointment generation (TODO)

**Guards**:

- Public endpoints for guest booking ✅
- Customer endpoints for authenticated users ✅
- Admin/Staff for management ✅

**Implementation Details**:

- ✅ DTOs: CreateAppointmentDto, CreateGuestAppointmentDto, UpdateAppointmentDto, UpdateAppointmentStatusDto
- ✅ Response DTOs: AppointmentResponseDto, AvailabilityResponseDto, TimeSlotDto
- ✅ Repositories: AppointmentRepository, AppointmentExtraRepository with complex queries
- ✅ Repository interfaces with type safety
- ✅ AvailabilityService: Complex time slot calculation logic
  - 15-minute interval slots
  - Working hours validation
  - Break/time-off overlap detection
  - Existing appointment conflict checking
  - Buffer time consideration
- ✅ AppointmentsService: Complete booking system
  - Guest user auto-creation
  - Service validation and price calculation
  - Extras handling with quantity support
  - Conflict detection before booking
  - Status management with cancellation tracking
  - Store appointment count tracking
- ✅ Controller with 14 endpoints covering all scenarios
- ✅ Module registration in AppModule with cross-module dependencies (Staff, Services)
- ✅ Exports for cross-module usage

---

### 8. Custom Fields Module (Priority: MEDIUM)

**Purpose**: Dynamic form fields for appointments

**Features**:

- [ ] CRUD operations for custom fields
- [ ] Field types (text, textarea, select, checkbox, radio, date, file)
- [ ] Service-specific or store-wide fields
- [ ] Required field validation
- [ ] Field positioning
- [ ] Custom field values in appointments

**Endpoints**:

```
POST   /stores/:storeId/custom-fields        - Create custom field
GET    /stores/:storeId/custom-fields        - List custom fields
PATCH  /stores/:storeId/custom-fields/:id    - Update custom field
DELETE /stores/:storeId/custom-fields/:id    - Delete custom field
```

**Guards**: Admin/Staff only

---

## Phase 4: Widget & Public Booking

### 9. Widget Module (Priority: HIGH) ✅

**Purpose**: Embeddable booking widget for store websites (Amelia-inspired design)

**Status**: COMPLETE (9 endpoints implemented)

**Implemented Features**:

- ✅ Widget settings management
- ✅ Widget customization (colors, fonts, layout)
- ✅ Two layout modes: "list" (single page) & "steps" (multi-step wizard)
- ✅ 7 configurable sidebar menu items (service, employee, location, extras, dateTime, customerInfo, payment)
- ✅ Field requirement toggles (employee, location, lastName, email, phone)
- ✅ Comprehensive styling (11 color properties)
- ✅ Typography settings (fontFamily, fontSize)
- ✅ Button styling (borderRadius)
- ✅ Progress bar toggle
- ✅ Guest booking toggle
- ✅ Redirect URL after booking
- ✅ Secure widget key generation (32-byte hex using crypto.randomBytes)
- ✅ Embed code generation (async script tag + iframe)
- ✅ Public widget endpoints (no auth required)
- ✅ Default settings auto-creation

**Endpoints**:

```
# Widget Settings (Admin - 4 endpoints)
GET    /stores/:storeId/widget-settings           - Get widget settings
PATCH  /stores/:storeId/widget-settings           - Update widget settings
POST   /stores/:storeId/widget-settings/regenerate-key - Regenerate widget key
GET    /stores/:storeId/widget-settings/embed-code - Get embed codes

# Public Widget API (No Auth - 5 endpoints)
GET    /public/widget/:widgetKey/config           - Get widget configuration
GET    /public/widget/:widgetKey/services         - Get available services
GET    /public/widget/:widgetKey/locations        - Get locations
GET    /public/widget/:widgetKey/staff            - Get staff members
GET    /public/widget/:widgetKey/availability     - Get availability
```

**Technical Implementation**:

- DTOs: 5 files (update settings, response, config, embed code, barrel exports)
- Repository: 6 methods (create, findByStoreId, findByWidgetKey, update, delete, generateWidgetKey)
- Service: 9 methods (4 admin + 5 public API)
- Default Colors: Primary #1A84EE, Sidebar #F5F7FA (Amelia-inspired)
- Default Font: Inter, sans-serif (14px)
- Widget Key: Cryptographically secure with crypto.randomBytes(32)
- Embed Options: Async script loading + iframe (800px default height)

**Guards**: Public endpoints (@Public decorator), Admin for settings management

---

## Phase 5: Analytics & Reports

### 10. Analytics Module (Priority: MEDIUM)

**Purpose**: Business insights and reporting

**Features**:

- [ ] Dashboard statistics
- [ ] Appointment reports (by date, service, staff)
- [ ] Revenue reports
- [ ] Customer reports
- [ ] Popular services
- [ ] Staff performance
- [ ] Booking trends
- [ ] Cancellation rates
- [ ] Export reports (CSV, PDF)

**Endpoints**:

```
GET    /stores/:storeId/analytics/dashboard       - Dashboard overview
GET    /stores/:storeId/analytics/appointments    - Appointment analytics
GET    /stores/:storeId/analytics/revenue         - Revenue analytics
GET    /stores/:storeId/analytics/customers       - Customer analytics
GET    /stores/:storeId/analytics/staff           - Staff performance
GET    /stores/:storeId/analytics/services        - Service popularity
GET    /stores/:storeId/analytics/export          - Export report
```

**Guards**: Admin/Staff only

---

## Phase 6: Notifications & Communication

### 11. Notifications Module (Priority: MEDIUM)

**Purpose**: Email/SMS notifications for appointments

**Features**:

- [ ] Email service integration (SendGrid/AWS SES)
- [ ] SMS service integration (Twilio)
- [ ] Appointment confirmation emails
- [ ] Appointment reminder emails (24h, 1h before)
- [ ] Cancellation notifications
- [ ] Staff invitation emails
- [ ] Template management
- [ ] Notification preferences

**Endpoints**:

```
GET    /stores/:storeId/notifications/settings    - Get notification settings
PATCH  /stores/:storeId/notifications/settings    - Update notification settings
GET    /stores/:storeId/notifications/templates   - List templates
PATCH  /stores/:storeId/notifications/templates/:id - Update template
POST   /stores/:storeId/notifications/test        - Send test notification
```

**Guards**: Admin only

---

## Phase 7: Payments

### 12. Payments Module (Priority: MEDIUM)

**Purpose**: Payment processing for appointments and subscriptions

**Features**:

- [ ] Stripe integration for subscription payments (freemium vs paid)
- [ ] Payment processing for appointments
- [ ] Payment method management
- [ ] Invoice generation
- [ ] Refund handling
- [ ] Payment history
- [ ] Webhook handling

**Endpoints**:

```
# Subscription Payments (Admin)
POST   /payments/subscribe                        - Subscribe to paid plan
POST   /payments/upgrade                          - Upgrade plan
POST   /payments/cancel-subscription              - Cancel subscription
GET    /payments/subscription                     - Get subscription status
GET    /payments/invoices                         - List invoices

# Appointment Payments (Customer)
POST   /appointments/:id/payment                  - Process payment
GET    /appointments/:id/invoice                  - Get invoice
POST   /appointments/:id/refund                   - Request refund
```

**Guards**: Authenticated users

---

## Phase 8: Advanced Features

### 13. Calendar Integration Module (Priority: LOW)

**Purpose**: Sync with external calendars

**Features**:

- [ ] Google Calendar integration
- [ ] Outlook Calendar integration
- [ ] iCal export
- [ ] Two-way sync options

---

### 14. Customer Management Module (Priority: LOW)

**Purpose**: Enhanced customer management

**Features**:

- [ ] Customer profiles
- [ ] Appointment history
- [ ] Customer notes
- [ ] Favorite services/staff
- [ ] Customer tags/segments
- [ ] Loyalty programs

---

### 15. Reviews & Ratings Module (Priority: LOW)

**Purpose**: Customer feedback system

**Features**:

- [ ] Service ratings
- [ ] Staff ratings
- [ ] Review management
- [ ] Response to reviews

---

## 🛠️ Technical Tasks

### Infrastructure

- [ ] Database migrations setup (Drizzle)
- [ ] Seeding scripts for development
- [ ] Error handling middleware
- [ ] Logging setup (Winston/Pino)
- [ ] API documentation (Swagger)
- [ ] Rate limiting
- [ ] CORS configuration
- [ ] File upload service (for images)
- [ ] Caching layer (Redis)
- [ ] Queue system for background jobs (Bull)

### Testing

- [ ] Unit tests for services
- [ ] Integration tests for APIs
- [ ] E2E tests for critical flows
- [ ] Test coverage setup

### DevOps

- [ ] Docker setup
- [ ] CI/CD pipeline
- [ ] Environment configurations
- [ ] Production deployment strategy

### Security

- [ ] Input validation (class-validator)
- [ ] SQL injection prevention
- [ ] XSS prevention
- [ ] CSRF protection
- [ ] Rate limiting per user/IP
- [ ] API key management for widget

---

## 📊 Recommended Development Order

1. **Week 1-2**: Stores Module + Categories Module
2. **Week 3**: Locations Module + Services Module
3. **Week 4**: Staff Module (invitation system)
4. **Week 5-6**: Appointments Module (core logic + availability)
5. **Week 7**: Widget Module (public endpoints)
6. **Week 8**: Custom Fields Module + Widget Integration
7. **Week 9**: Notifications Module (email integration)
8. **Week 10**: Analytics Module
9. **Week 11**: Payments Module
10. **Week 12+**: Advanced features + Testing + Polish

---

## 🎯 MVP (Minimum Viable Product)

For initial launch, focus on:

1. ✅ Auth Module (DONE)
2. Stores Module
3. Services Module (basic)
4. Staff Module (basic)
5. Appointments Module (core)
6. Widget Module (basic)

This gives you a working booking system that can be deployed and tested.

---

## 📝 Notes

- Each module should have its own folder: `controller`, `service`, `dto`, `entities`, `repository`
- Use repository pattern for database operations
- Implement proper error handling and validation
- Add pagination for list endpoints
- Use query builders for complex filters
- Implement soft deletes where appropriate
- Add proper logging for debugging
- Write clear API documentation
- Follow NestJS best practices

---

## 🔄 Current Status

**Phase**: Phase 3 Complete! Moving to Phase 4 (Widget & Public Booking)
**Progress**: 85% (Phase 1-3: 100% Complete)
**Next Task**: Implement Widget Module or Custom Fields Module (MEDIUM Priority)

**Completed Modules**:

1. ✅ Authentication Module (Local auth, JWT, Refresh tokens, RBAC)
2. ✅ Stores Module (Store CRUD, Analytics, Ownership verification)
3. ✅ Categories Module (Category CRUD, Ordering, Color/Icon customization)
4. ✅ Locations Module (Location CRUD, Geo-coordinates, Public visibility)
5. ✅ Services Module (Service CRUD, Extras, Pricing, Capacity, Buffer times)
6. ✅ Staff Module (Invitations, Working hours, Breaks, Service assignments)
7. ✅ Appointments Module (Booking system, Availability calculation, Guest booking, Status management)
