import {
  pgTable,
  serial,
  varchar,
  timestamp,
  text,
  integer,
  boolean,
  decimal,
  uuid,
  pgEnum,
  json,
  time,
  date,
  unique,
  index,
} from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';

// ================================
// ENUMS
// ================================
export const userRoleEnum = pgEnum('user_role', [
  'admin',
  'manager',
  'staff',
  'customer',
]);
export const paymentStatusEnum = pgEnum('payment_status', [
  'freemium',
  'paid',
  'business',
]);
export const authProviderEnum = pgEnum('auth_provider', [
  'local',
  'google',
  'facebook',
  'apple',
]);
export const appointmentStatusEnum = pgEnum('appointment_status', [
  'pending',
  'confirmed',
  'cancelled',
  'completed',
  'no_show',
  'expired',
]);
export const paymentMethodEnum = pgEnum('payment_method', [
  'cash',
  'card',
  'online',
  'stripe',
  'paypal',
]);
export const widgetLayoutEnum = pgEnum('widget_layout', ['list', 'steps']);
export const dayOfWeekEnum = pgEnum('day_of_week', [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
]);
export const invitationStatusEnum = pgEnum('invitation_status', [
  'pending',
  'accepted',
  'expired',
  'cancelled',
]);

export const notificationChannelEnum = pgEnum('notification_channel', [
  'email',
  'sms',
  'both',
]);

export const templateTypeEnum = pgEnum('template_type', [
  'appointment_confirmation',
  'appointment_reminder_24h',
  'appointment_reminder_1h',
  'appointment_cancelled',
  'appointment_rescheduled',
  'appointment_feedback',
  'coupon_assigned',
  'staff_invitation',
  'password_reset',
]);

export const staffBreakStatusEnum = pgEnum('staff_break_status', [
  'pending',
  'approved',
  'declined',
]);

export const staffBreakTypeEnum = pgEnum('staff_break_type', [
  'paid_leave',
  'sick_leave',
  'unpaid_leave',
  'break',
  'other',
]);

export const activityTypeEnum = pgEnum('activity_type', [
  'appointment',
  'customer',
  'staff',
]);

export const fileTypeEnum = pgEnum('file_type', [
  'image',
  'pdf',
  'document',
  'other',
]);

// ================================
// USERS & AUTHENTICATION
// ================================
export const users = pgTable(
  'users',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    customerNumber: serial('customer_number').unique(),
    email: varchar('email', { length: 255 }).notNull().unique(),
    firstName: varchar('first_name', { length: 255 }),
    lastName: varchar('last_name', { length: 255 }),
    phone: varchar('phone', { length: 50 }),
    password: text('password'), // nullable for social login and customers
    role: userRoleEnum('role').default('admin').notNull(),
    authProvider: authProviderEnum('auth_provider').default('local').notNull(),
    providerId: varchar('provider_id', { length: 255 }), // ID from social provider
    avatar: text('avatar'),
    isActive: boolean('is_active').default(true).notNull(),
    emailVerified: boolean('email_verified').default(false).notNull(),
    lastLogin: timestamp('last_login'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('users_email_idx').on(table.email),
    index('users_role_idx').on(table.role),
  ],
);

// ================================
// STORES (Multi-tenant SaaS)
// ================================
export const stores = pgTable(
  'stores',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    ownerId: uuid('owner_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull()
      .unique(), // Admin user who owns this store
    name: varchar('name', { length: 255 }).notNull(),
    slug: varchar('slug', { length: 255 }).notNull().unique(), // URL-friendly identifier
    description: text('description'),
    logo: text('logo'),
    email: varchar('email', { length: 255 }),
    phone: varchar('phone', { length: 50 }),

    currency: varchar('currency', { length: 3 }).default('TRY'),
    paymentStatus: paymentStatusEnum('payment_status')
      .default('freemium')
      .notNull(),

    // Store images for hosted widget page
    storeImages: json('store_images').$type<string[]>().default([]),

    // Feedback
    sendFeedbackViaSms: boolean('send_feedback_via_sms')
      .default(false)
      .notNull(),

    // Analytics & Stats
    totalAppointments: integer('total_appointments').default(0),
    // totalRevenue: decimal('total_revenue', { precision: 10, scale: 2 }).default(
    //   '0',
    // ),
    totalCustomers: integer('total_customers').default(0),

    // Settings
    isActive: boolean('is_active').default(true).notNull(),

    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('stores_owner_id_idx').on(table.ownerId),
    index('stores_slug_idx').on(table.slug),
  ],
);

// Store-specific customer numbering
export const storeCustomers = pgTable(
  'store_customers',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    storeId: uuid('store_id')
      .references(() => stores.id, { onDelete: 'cascade' })
      .notNull(),

    customerId: uuid('customer_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    publicNumber: varchar('public_number', { length: 20 }).notNull(),
    publicNumberCounter: integer('public_number_counter').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    unique('store_customers_store_customer').on(
      table.storeId,
      table.customerId,
    ),
    unique('store_customers_store_public_number').on(
      table.storeId,
      table.publicNumber,
    ),
    unique('store_customers_store_public_number_counter').on(
      table.storeId,
      table.publicNumberCounter,
    ),
    index('store_customers_store_id_idx').on(table.storeId),
  ],
);

// ================================
// ACTIVITIES (Timeline)
// ================================
export const activities = pgTable(
  'activities',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    storeId: uuid('store_id')
      .references(() => stores.id, { onDelete: 'cascade' })
      .notNull(),
    type: activityTypeEnum('type').notNull(),
    message: text('message').notNull(),
    metadata: json('metadata'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('activities_store_id_idx').on(table.storeId),
    index('activities_created_at_idx').on(table.createdAt),
  ],
);

export const refreshTokens = pgTable(
  'refresh_tokens',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    token: text('token').notNull().unique(),
    expiresAt: timestamp('expires_at').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('refresh_tokens_token_idx').on(table.token),
    index('refresh_tokens_user_id_idx').on(table.userId),
  ],
);

// Staff invitation system
export const staffInvitations = pgTable(
  'staff_invitations',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    storeId: uuid('store_id')
      .references(() => stores.id, { onDelete: 'cascade' })
      .notNull(),
    email: varchar('email', { length: 255 }).notNull(),
    token: varchar('token', { length: 255 }).notNull().unique(),
    status: invitationStatusEnum('status').default('pending').notNull(),
    invitedBy: uuid('invited_by').references(() => users.id, {
      onDelete: 'set null',
    }),
    locationId: uuid('location_id').references(() => locations.id, {
      onDelete: 'set null',
    }),
    title: varchar('title', { length: 255 }),
    expiresAt: timestamp('expires_at').notNull(),
    acceptedAt: timestamp('accepted_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('staff_invitations_store_id_idx').on(table.storeId),
    index('staff_invitations_email_idx').on(table.email),
    index('staff_invitations_token_idx').on(table.token),
    index('staff_invitations_location_id_idx').on(table.locationId),
  ],
);

// ================================
// BUSINESS ENTITIES
// ================================
export const categories = pgTable(
  'categories',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    storeId: uuid('store_id')
      .references(() => stores.id, { onDelete: 'cascade' })
      .notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description'),
    color: varchar('color', { length: 7 }), // Hex color
    icon: varchar('icon', { length: 50 }),
    position: integer('position').default(0),
    isVisible: boolean('is_visible').default(true).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [index('categories_store_id_idx').on(table.storeId)],
);

export const locations = pgTable(
  'locations',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    storeId: uuid('store_id')
      .references(() => stores.id, { onDelete: 'cascade' })
      .notNull(), // Store branch/location
    name: varchar('name', { length: 255 }).notNull(),
    address: text('address'),
    city: varchar('city', { length: 100 }),
    state: varchar('state', { length: 100 }),
    zipCode: varchar('zip_code', { length: 20 }),
    country: varchar('country', { length: 100 }),
    phone: varchar('phone', { length: 50 }),
    email: varchar('email', { length: 255 }),
    latitude: decimal('latitude', { precision: 10, scale: 7 }),
    longitude: decimal('longitude', { precision: 10, scale: 7 }),
    isVisible: boolean('is_visible').default(true).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [index('locations_store_id_idx').on(table.storeId)],
);

export const services = pgTable(
  'services',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    storeId: uuid('store_id')
      .references(() => stores.id, { onDelete: 'cascade' })
      .notNull(),
    categoryId: uuid('category_id').references(() => categories.id, {
      onDelete: 'set null',
    }),
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description'),
    duration: integer('duration').notNull(), // minutes
    price: decimal('price', { precision: 10, scale: 2 }).notNull(),
    capacity: integer('capacity').default(1).notNull(), // max people per appointment
    bufferTimeBefore: integer('buffer_time_before').default(0), // minutes
    bufferTimeAfter: integer('buffer_time_after').default(0), // minutes
    image: text('image'),
    isVisible: boolean('is_visible').default(true).notNull(),
    showBringingAnyoneOption: boolean('show_bringing_anyone_option').default(
      false,
    ),
    allowRecurring: boolean('allow_recurring').default(false),
    position: integer('position').default(0),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('services_store_id_idx').on(table.storeId),
    index('services_category_id_idx').on(table.categoryId),
  ],
);

export const serviceExtras = pgTable(
  'service_extras',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    serviceId: uuid('service_id')
      .references(() => services.id, { onDelete: 'cascade' })
      .notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description'),
    price: decimal('price', { precision: 10, scale: 2 }).notNull(),
    duration: integer('duration').default(0), // additional minutes
    maxQuantity: integer('max_quantity').default(1),
    position: integer('position').default(0),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [index('service_extras_service_id_idx').on(table.serviceId)],
);

// Staff assignments
export const staffMembers = pgTable(
  'staff_members',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull()
      .unique(), // Staff user
    storeId: uuid('store_id')
      .references(() => stores.id, { onDelete: 'cascade' })
      .notNull(), // Store they belong to
    locationId: uuid('location_id').references(() => locations.id, {
      onDelete: 'set null',
    }), // Specific branch/location (optional)
    bio: text('bio'),
    title: varchar('title', { length: 255 }),
    isVisible: boolean('is_visible').default(true).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('staff_members_store_id_idx').on(table.storeId),
    index('staff_members_location_id_idx').on(table.locationId),
  ],
);

// Service-Staff relationship (many-to-many)
export const serviceStaff = pgTable(
  'service_staff',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    serviceId: uuid('service_id')
      .references(() => services.id, { onDelete: 'cascade' })
      .notNull(),
    staffId: uuid('staff_id')
      .references(() => staffMembers.id, { onDelete: 'cascade' })
      .notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    unique('unique_service_staff').on(table.serviceId, table.staffId),
    index('service_staff_service_id_idx').on(table.serviceId),
    index('service_staff_staff_id_idx').on(table.staffId),
  ],
);

// Service-Location relationship (many-to-many)
export const serviceLocations = pgTable(
  'service_locations',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    serviceId: uuid('service_id')
      .references(() => services.id, { onDelete: 'cascade' })
      .notNull(),
    locationId: uuid('location_id')
      .references(() => locations.id, { onDelete: 'cascade' })
      .notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    unique('unique_service_location').on(table.serviceId, table.locationId),
    index('service_locations_service_id_idx').on(table.serviceId),
    index('service_locations_location_id_idx').on(table.locationId),
  ],
);

// Staff working hours
export const staffWorkingHours = pgTable(
  'staff_working_hours',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    staffId: uuid('staff_id')
      .references(() => staffMembers.id, { onDelete: 'cascade' })
      .notNull(),
    dayOfWeek: dayOfWeekEnum('day_of_week').notNull(),
    startTime: time('start_time').notNull(),
    endTime: time('end_time').notNull(),
    isActive: boolean('is_active').default(true).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [index('staff_working_hours_staff_id_idx').on(table.staffId)],
);

// Staff breaks/time off
export const staffBreaks = pgTable(
  'staff_breaks',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    staffId: uuid('staff_id')
      .references(() => staffMembers.id, { onDelete: 'cascade' })
      .notNull(),
    type: staffBreakTypeEnum('type').default('other').notNull(),
    status: staffBreakStatusEnum('status').default('pending').notNull(),
    startDate: date('start_date').notNull(),
    endDate: date('end_date').notNull(),
    startTime: time('start_time'),
    endTime: time('end_time'),
    reason: text('reason'),
    isRecurring: boolean('is_recurring').default(false),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [index('staff_breaks_staff_id_idx').on(table.staffId)],
);

// ================================
// APPOINTMENTS
// ================================
export const appointments = pgTable(
  'appointments',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    publicNumber: varchar('public_number', { length: 20 }).notNull(),
    publicNumberCounter: integer('public_number_counter').notNull(),
    storeId: uuid('store_id')
      .references(() => stores.id, { onDelete: 'cascade' })
      .notNull(), // Store this appointment belongs to
    customerId: uuid('customer_id').references(() => users.id, {
      onDelete: 'set null',
    }), // Can be null for guest bookings
    serviceId: uuid('service_id').references(() => services.id, {
      onDelete: 'set null',
    }),
    staffId: uuid('staff_id').references(() => staffMembers.id, {
      onDelete: 'set null',
    }),
    locationId: uuid('location_id').references(() => locations.id, {
      onDelete: 'set null',
    }),

    // Guest customer info (if customerId is null)
    guestFirstName: varchar('guest_first_name', { length: 255 }),
    guestLastName: varchar('guest_last_name', { length: 255 }),
    guestEmail: varchar('guest_email', { length: 255 }),
    guestPhone: varchar('guest_phone', { length: 50 }),

    // Appointment details
    startDateTime: timestamp('start_date_time').notNull(),
    endDateTime: timestamp('end_date_time').notNull(),
    numberOfPeople: integer('number_of_people').default(1),
    status: appointmentStatusEnum('status').default('pending').notNull(),

    // Payment
    totalPrice: decimal('total_price', { precision: 10, scale: 2 }).notNull(),
    paymentMethod: paymentMethodEnum('payment_method'),
    isPaid: boolean('is_paid').default(false).notNull(),
    paidAt: timestamp('paid_at'),

    // Notes
    customerNotes: text('customer_notes'),
    internalNotes: text('internal_notes'), // Only visible to staff/admin

    // Cancellation
    cancelledAt: timestamp('cancelled_at'),
    cancellationReason: text('cancellation_reason'),

    // Recurring
    parentAppointmentId: uuid('parent_appointment_id').references(
      () => appointments.id,
      { onDelete: 'set null' },
    ),
    isRecurring: boolean('is_recurring').default(false),

    // Reminder flags
    reminder24hSent: boolean('reminder_24h_sent').default(false),
    reminder1hSent: boolean('reminder_1h_sent').default(false),

    // Feedback token (for secure feedback submission)
    feedbackToken: varchar('feedback_token', { length: 64 }),
    feedbackTokenExpiresAt: timestamp('feedback_token_expires_at'),
    feedbackSentAt: timestamp('feedback_sent_at'),

    // Cancellation token (for one-time cancel link)
    cancelToken: varchar('cancel_token', { length: 64 }),
    cancelTokenExpiresAt: timestamp('cancel_token_expires_at'),
    cancelTokenUsedAt: timestamp('cancel_token_used_at'),

    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    unique('appointments_store_public_number').on(
      table.storeId,
      table.publicNumber,
    ),
    unique('appointments_store_public_number_counter').on(
      table.storeId,
      table.publicNumberCounter,
    ),
    unique('appointments_feedback_token').on(table.feedbackToken),
    unique('appointments_cancel_token').on(table.cancelToken),
    index('appointments_store_id_idx').on(table.storeId),
    index('appointments_customer_id_idx').on(table.customerId),
    index('appointments_staff_id_idx').on(table.staffId),
    index('appointments_start_date_time_idx').on(table.startDateTime),
    index('appointments_status_idx').on(table.status),
    index('appointments_cancel_token_idx').on(table.cancelToken),
  ],
);

export const appointmentExtras = pgTable(
  'appointment_extras',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    appointmentId: uuid('appointment_id')
      .references(() => appointments.id, { onDelete: 'cascade' })
      .notNull(),
    extraId: uuid('extra_id')
      .references(() => serviceExtras.id, { onDelete: 'cascade' })
      .notNull(),
    quantity: integer('quantity').default(1).notNull(),
    price: decimal('price', { precision: 10, scale: 2 }).notNull(), // Price at time of booking
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('appointment_extras_appointment_id_idx').on(table.appointmentId),
  ],
);

// ================================
// DISCOUNT COUPONS
// ================================
export const couponTypeEnum = pgEnum('coupon_type', [
  'percentage',
  'fixed_amount',
]);

export const couponStatusEnum = pgEnum('coupon_status', [
  'active',
  'expired',
  'used',
  'cancelled',
]);

export const coupons = pgTable(
  'coupons',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    storeId: uuid('store_id')
      .references(() => stores.id, { onDelete: 'cascade' })
      .notNull(),
    code: varchar('code', { length: 50 }).notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description'),
    type: couponTypeEnum('type').notNull(),
    value: decimal('value', { precision: 10, scale: 2 }).notNull(), // Percentage (0-100) or fixed amount
    minPurchaseAmount: decimal('min_purchase_amount', {
      precision: 10,
      scale: 2,
    }),
    maxDiscountAmount: decimal('max_discount_amount', {
      precision: 10,
      scale: 2,
    }), // Max discount for percentage type
    usageLimit: integer('usage_limit'), // Total usage limit (null = unlimited)
    usageLimitPerCustomer: integer('usage_limit_per_customer').default(1),
    usedCount: integer('used_count').default(0),
    validFrom: timestamp('valid_from').notNull(),
    validUntil: timestamp('valid_until').notNull(),
    isActive: boolean('is_active').default(true).notNull(),
    // Applicable services (null = all services)
    applicableServiceIds: json('applicable_service_ids').$type<string[]>(),
    createdBy: uuid('created_by').references(() => users.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    unique('coupons_store_code').on(table.storeId, table.code),
    index('coupons_store_id_idx').on(table.storeId),
    index('coupons_code_idx').on(table.code),
    index('coupons_valid_until_idx').on(table.validUntil),
  ],
);

// Customer-specific coupon assignments (for personal coupons)
export const customerCoupons = pgTable(
  'customer_coupons',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    couponId: uuid('coupon_id')
      .references(() => coupons.id, { onDelete: 'cascade' })
      .notNull(),
    customerId: uuid('customer_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    storeId: uuid('store_id')
      .references(() => stores.id, { onDelete: 'cascade' })
      .notNull(),
    status: couponStatusEnum('status').default('active').notNull(),
    usedCount: integer('used_count').default(0),
    usedAt: timestamp('used_at'),
    notifiedAt: timestamp('notified_at'), // When customer was notified about this coupon
    assignedBy: uuid('assigned_by').references(() => users.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    unique('customer_coupons_coupon_customer').on(
      table.couponId,
      table.customerId,
    ),
    index('customer_coupons_coupon_id_idx').on(table.couponId),
    index('customer_coupons_customer_id_idx').on(table.customerId),
    index('customer_coupons_store_id_idx').on(table.storeId),
    index('customer_coupons_status_idx').on(table.status),
  ],
);

// Coupon usage history
export const couponUsages = pgTable(
  'coupon_usages',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    couponId: uuid('coupon_id')
      .references(() => coupons.id, { onDelete: 'cascade' })
      .notNull(),
    customerId: uuid('customer_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    appointmentId: uuid('appointment_id').references(() => appointments.id, {
      onDelete: 'set null',
    }),
    storeId: uuid('store_id')
      .references(() => stores.id, { onDelete: 'cascade' })
      .notNull(),
    discountAmount: decimal('discount_amount', {
      precision: 10,
      scale: 2,
    }).notNull(),
    originalAmount: decimal('original_amount', {
      precision: 10,
      scale: 2,
    }).notNull(),
    usedAt: timestamp('used_at').defaultNow().notNull(),
  },
  (table) => [
    index('coupon_usages_coupon_id_idx').on(table.couponId),
    index('coupon_usages_customer_id_idx').on(table.customerId),
    index('coupon_usages_appointment_id_idx').on(table.appointmentId),
  ],
);

// ================================
// APPOINTMENT FEEDBACK
// ================================
export const appointmentFeedback = pgTable(
  'appointment_feedback',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    appointmentId: uuid('appointment_id')
      .references(() => appointments.id, { onDelete: 'cascade' })
      .notNull()
      .unique(),
    storeId: uuid('store_id')
      .references(() => stores.id, { onDelete: 'cascade' })
      .notNull(),
    customerId: uuid('customer_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    staffId: uuid('staff_id').references(() => staffMembers.id, {
      onDelete: 'set null',
    }),
    serviceId: uuid('service_id').references(() => services.id, {
      onDelete: 'set null',
    }),
    // Ratings (1-5)
    overallRating: integer('overall_rating').notNull(),
    serviceRating: integer('service_rating'),
    staffRating: integer('staff_rating'),
    cleanlinessRating: integer('cleanliness_rating'),
    valueRating: integer('value_rating'), // Value for money
    // Feedback text
    comment: text('comment'),
    isVerified: boolean('is_verified').default(true).notNull(), // Verified purchase
    // Timestamps
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('appointment_feedback_store_id_idx').on(table.storeId),
    index('appointment_feedback_customer_id_idx').on(table.customerId),
    index('appointment_feedback_staff_id_idx').on(table.staffId),
    index('appointment_feedback_service_id_idx').on(table.serviceId),
    index('appointment_feedback_overall_rating_idx').on(table.overallRating),
    index('appointment_feedback_created_at_idx').on(table.createdAt),
  ],
);

export const notifications = pgTable(
  'notifications',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    storeId: uuid('store_id')
      .references(() => stores.id, { onDelete: 'cascade' })
      .notNull(),
    title: varchar('title', { length: 255 }).notNull(),
    message: text('message').notNull(),
    type: varchar('type', { length: 50 }).notNull(),
    metadata: json('metadata'),
    isRead: boolean('is_read').default(false).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('notifications_user_id_idx').on(table.userId),
    index('notifications_store_id_idx').on(table.storeId),
    index('notifications_is_read_idx').on(table.isRead),
  ],
);

// ================================
// WIDGET CUSTOMIZATION
// ================================
export const widgetSettings = pgTable(
  'widget_settings',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    storeId: uuid('store_id')
      .references(() => stores.id, { onDelete: 'cascade' })
      .notNull()
      .unique(),

    // Layout & Structure
    layout: widgetLayoutEnum('layout').default('list').notNull(),
    showCompanyEmail: boolean('show_company_email').default(true),
    companyEmail: varchar('company_email', { length: 255 }),

    // Sidebar Configuration
    sidebarMenuItems: json('sidebar_menu_items')
      .$type<{
        service: boolean;
        employee: boolean;
        location: boolean;
        extras: boolean;
        dateTime: boolean;
        customerInfo: boolean;
        payment: boolean;
      }>()
      .default({
        service: true,
        employee: true,
        location: true,
        extras: true,
        dateTime: true,
        customerInfo: true,
        payment: true,
      }),

    // Colors & Styling
    primaryColor: varchar('primary_color', { length: 7 }).default('#1A84EE'),
    secondaryColor: varchar('secondary_color', { length: 7 }).default(
      '#ffffff',
    ),
    sidebarBackgroundColor: varchar('sidebar_background_color', {
      length: 7,
    }).default('#F5F7FA'),
    contentBackgroundColor: varchar('content_background_color', {
      length: 7,
    }).default('#ffffff'),
    textColor: varchar('text_color', { length: 7 }).default('#333333'),
    headingColor: varchar('heading_color', { length: 7 }).default('#1A1A1A'),

    // Typography
    fontFamily: varchar('font_family', { length: 100 }).default(
      'Inter, sans-serif',
    ),
    fontSize: integer('font_size').default(14), // Base font size in px

    // Button Styling
    buttonBorderRadius: integer('button_border_radius').default(8), // px

    // Other Settings
    showProgressBar: boolean('show_progress_bar').default(true),
    allowGuestBooking: boolean('allow_guest_booking').default(true),
    redirectUrlAfterBooking: text('redirect_url_after_booking'),

    // Widget embed code/key
    widgetKey: varchar('widget_key', { length: 255 }).notNull().unique(),

    // Domain allowlist
    allowedDomains: json('allowed_domains').$type<string[]>().default([]),

    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('widget_settings_widget_key_idx').on(table.widgetKey),
    index('widget_settings_store_id_idx').on(table.storeId),
  ],
);

// Custom fields for services
export const customFields = pgTable(
  'custom_fields',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    storeId: uuid('store_id')
      .references(() => stores.id, { onDelete: 'cascade' })
      .notNull(),
    serviceId: uuid('service_id').references(() => services.id, {
      onDelete: 'cascade',
    }),
    label: varchar('label', { length: 255 }).notNull(),
    type: varchar('type', { length: 50 }).notNull(), // text, textarea, select, checkbox, radio, date, file
    options: json('options').$type<string[]>(), // For select, radio, checkbox
    placeholder: varchar('placeholder', { length: 255 }),
    isRequired: boolean('is_required').default(false),
    position: integer('position').default(0),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('custom_fields_store_id_idx').on(table.storeId),
    index('custom_fields_service_id_idx').on(table.serviceId),
  ],
);

export const appointmentCustomFieldValues = pgTable(
  'appointment_custom_field_values',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    appointmentId: uuid('appointment_id')
      .references(() => appointments.id, { onDelete: 'cascade' })
      .notNull(),
    customFieldId: uuid('custom_field_id')
      .references(() => customFields.id, { onDelete: 'cascade' })
      .notNull(),
    value: text('value'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('appointment_custom_field_values_appointment_id_idx').on(
      table.appointmentId,
    ),
  ],
);

// ================================
// NOTIFICATIONS
// ================================
export const notificationSettings = pgTable(
  'notification_settings',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    storeId: uuid('store_id')
      .references(() => stores.id, { onDelete: 'cascade' })
      .notNull()
      .unique(),

    // Appointment Confirmation
    appointmentConfirmationEnabled: boolean(
      'appointment_confirmation_enabled',
    ).default(true),
    appointmentConfirmationChannel: notificationChannelEnum(
      'appointment_confirmation_channel',
    ).default('email'),

    // Appointment Reminders
    appointmentReminderEnabled: boolean('appointment_reminder_enabled').default(
      true,
    ),
    appointmentReminderChannel: notificationChannelEnum(
      'appointment_reminder_channel',
    ).default('email'),
    reminder24hEnabled: boolean('reminder_24h_enabled').default(true),
    reminder1hEnabled: boolean('reminder_1h_enabled').default(false),

    // Appointment Cancellation
    appointmentCancellationEnabled: boolean(
      'appointment_cancellation_enabled',
    ).default(true),
    appointmentCancellationChannel: notificationChannelEnum(
      'appointment_cancellation_channel',
    ).default('email'),

    // Appointment Rescheduled
    appointmentRescheduledEnabled: boolean(
      'appointment_rescheduled_enabled',
    ).default(true),
    appointmentRescheduledChannel: notificationChannelEnum(
      'appointment_rescheduled_channel',
    ).default('email'),

    // Appointment Feedback
    feedbackRequestSmsEnabled: boolean('feedback_request_sms_enabled').default(
      false,
    ),

    // Staff Invitation
    staffInvitationEnabled: boolean('staff_invitation_enabled').default(true),

    // Email Configuration
    senderEmail: varchar('sender_email', { length: 255 }),
    senderName: varchar('sender_name', { length: 255 }),
    replyToEmail: varchar('reply_to_email', { length: 255 }),
    emailProvider: varchar('email_provider', { length: 50 }).default('smtp'), // sendgrid, aws-ses, smtp

    // SMS Configuration
    smsProvider: varchar('sms_provider', { length: 50 }), // twilio, aws-sns

    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [index('notification_settings_store_id_idx').on(table.storeId)],
);

export const notificationTemplates = pgTable(
  'notification_templates',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    storeId: uuid('store_id')
      .references(() => stores.id, { onDelete: 'cascade' })
      .notNull(),
    type: templateTypeEnum('type').notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description'),
    subject: varchar('subject', { length: 500 }),
    htmlContent: text('html_content'),
    textContent: text('text_content'),
    smsContent: text('sms_content'),
    availableVariables: json('available_variables').$type<string[]>(),
    isCustom: boolean('is_custom').default(false), // true if customized by user
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    unique('unique_store_template_type').on(table.storeId, table.type),
    index('notification_templates_store_id_idx').on(table.storeId),
    index('notification_templates_type_idx').on(table.type),
  ],
);

// ================================
// CUSTOMER FILES
// ================================
export const customerFiles = pgTable(
  'customer_files',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    storeId: uuid('store_id')
      .references(() => stores.id, { onDelete: 'cascade' })
      .notNull(),
    customerId: uuid('customer_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    uploadedBy: uuid('uploaded_by').references(() => users.id, {
      onDelete: 'set null',
    }),
    // File metadata
    fileName: varchar('file_name', { length: 255 }).notNull(),
    originalName: varchar('original_name', { length: 255 }).notNull(),
    mimeType: varchar('mime_type', { length: 100 }).notNull(),
    fileType: fileTypeEnum('file_type').notNull(),
    fileSize: integer('file_size').notNull(), // in bytes
    // Storage info
    storagePath: text('storage_path').notNull(), // Local path or S3 key
    storageProvider: varchar('storage_provider', { length: 50 })
      .default('local')
      .notNull(), // 'local', 's3', etc.
    // Optional metadata
    appointmentId: uuid('appointment_id').references(() => appointments.id, {
      onDelete: 'set null',
    }),
    description: text('description'),
    tags: json('tags').$type<string[]>(),
    // Timestamps
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('customer_files_store_id_idx').on(table.storeId),
    index('customer_files_customer_id_idx').on(table.customerId),
    index('customer_files_uploaded_by_idx').on(table.uploadedBy),
    index('customer_files_appointment_id_idx').on(table.appointmentId),
    index('customer_files_file_type_idx').on(table.fileType),
    index('customer_files_created_at_idx').on(table.createdAt),
  ],
);

// ================================
// RELATIONS (for Drizzle ORM queries)
// ================================
export const usersRelations = relations(users, ({ one, many }) => ({
  ownedStore: one(stores, { fields: [users.id], references: [stores.ownerId] }),
  staffProfile: one(staffMembers, {
    fields: [users.id],
    references: [staffMembers.userId],
  }),
  appointments: many(appointments),
  refreshTokens: many(refreshTokens),
  storeCustomers: many(storeCustomers),
  customerFiles: many(customerFiles),
}));

export const storesRelations = relations(stores, ({ one, many }) => ({
  owner: one(users, { fields: [stores.ownerId], references: [users.id] }),
  categories: many(categories),
  locations: many(locations),
  services: many(services),
  staffMembers: many(staffMembers),
  appointments: many(appointments),
  storeCustomers: many(storeCustomers),
  widgetSettings: one(widgetSettings),
  staffInvitations: many(staffInvitations),
  customFields: many(customFields),
  notificationSettings: one(notificationSettings),
  notificationTemplates: many(notificationTemplates),
  customerFiles: many(customerFiles),
}));

export const staffInvitationsRelations = relations(
  staffInvitations,
  ({ one }) => ({
    store: one(stores, {
      fields: [staffInvitations.storeId],
      references: [stores.id],
    }),
    location: one(locations, {
      fields: [staffInvitations.locationId],
      references: [locations.id],
    }),
    invitedByUser: one(users, {
      fields: [staffInvitations.invitedBy],
      references: [users.id],
    }),
  }),
);

export const categoriesRelations = relations(categories, ({ one, many }) => ({
  store: one(stores, { fields: [categories.storeId], references: [stores.id] }),
  services: many(services),
}));

export const locationsRelations = relations(locations, ({ one, many }) => ({
  store: one(stores, { fields: [locations.storeId], references: [stores.id] }),
  staffMembers: many(staffMembers),
  appointments: many(appointments),
  serviceLocations: many(serviceLocations),
}));

export const servicesRelations = relations(services, ({ one, many }) => ({
  store: one(stores, { fields: [services.storeId], references: [stores.id] }),
  category: one(categories, {
    fields: [services.categoryId],
    references: [categories.id],
  }),
  serviceExtras: many(serviceExtras),
  serviceStaff: many(serviceStaff),
  serviceLocations: many(serviceLocations),
  appointments: many(appointments),
  customFields: many(customFields),
}));

export const storeCustomersRelations = relations(storeCustomers, ({ one }) => ({
  store: one(stores, {
    fields: [storeCustomers.storeId],
    references: [stores.id],
  }),
  customer: one(users, {
    fields: [storeCustomers.customerId],
    references: [users.id],
  }),
}));

export const staffMembersRelations = relations(
  staffMembers,
  ({ one, many }) => ({
    user: one(users, { fields: [staffMembers.userId], references: [users.id] }),
    store: one(stores, {
      fields: [staffMembers.storeId],
      references: [stores.id],
    }),
    location: one(locations, {
      fields: [staffMembers.locationId],
      references: [locations.id],
    }),
    serviceStaff: many(serviceStaff),
    workingHours: many(staffWorkingHours),
    breaks: many(staffBreaks),
    appointments: many(appointments),
  }),
);

export const appointmentsRelations = relations(
  appointments,
  ({ one, many }) => ({
    store: one(stores, {
      fields: [appointments.storeId],
      references: [stores.id],
    }),
    customer: one(users, {
      fields: [appointments.customerId],
      references: [users.id],
    }),
    service: one(services, {
      fields: [appointments.serviceId],
      references: [services.id],
    }),
    staff: one(staffMembers, {
      fields: [appointments.staffId],
      references: [staffMembers.id],
    }),
    location: one(locations, {
      fields: [appointments.locationId],
      references: [locations.id],
    }),
    appointmentExtras: many(appointmentExtras),
    customFieldValues: many(appointmentCustomFieldValues),
  }),
);

export const appointmentExtrasRelations = relations(
  appointmentExtras,
  ({ one }) => ({
    appointment: one(appointments, {
      fields: [appointmentExtras.appointmentId],
      references: [appointments.id],
    }),
    extra: one(serviceExtras, {
      fields: [appointmentExtras.extraId],
      references: [serviceExtras.id],
    }),
  }),
);

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, { fields: [notifications.userId], references: [users.id] }),
  store: one(stores, {
    fields: [notifications.storeId],
    references: [stores.id],
  }),
}));

export const customerFilesRelations = relations(customerFiles, ({ one }) => ({
  store: one(stores, {
    fields: [customerFiles.storeId],
    references: [stores.id],
  }),
  customer: one(users, {
    fields: [customerFiles.customerId],
    references: [users.id],
  }),
  uploader: one(users, {
    fields: [customerFiles.uploadedBy],
    references: [users.id],
  }),
  appointment: one(appointments, {
    fields: [customerFiles.appointmentId],
    references: [appointments.id],
  }),
}));

// Coupon Relations
export const couponsRelations = relations(coupons, ({ one, many }) => ({
  store: one(stores, {
    fields: [coupons.storeId],
    references: [stores.id],
  }),
  createdByUser: one(users, {
    fields: [coupons.createdBy],
    references: [users.id],
  }),
  customerCoupons: many(customerCoupons),
  usages: many(couponUsages),
}));

export const customerCouponsRelations = relations(
  customerCoupons,
  ({ one }) => ({
    coupon: one(coupons, {
      fields: [customerCoupons.couponId],
      references: [coupons.id],
    }),
    customer: one(users, {
      fields: [customerCoupons.customerId],
      references: [users.id],
    }),
    store: one(stores, {
      fields: [customerCoupons.storeId],
      references: [stores.id],
    }),
    assignedByUser: one(users, {
      fields: [customerCoupons.assignedBy],
      references: [users.id],
    }),
  }),
);

export const couponUsagesRelations = relations(couponUsages, ({ one }) => ({
  coupon: one(coupons, {
    fields: [couponUsages.couponId],
    references: [coupons.id],
  }),
  customer: one(users, {
    fields: [couponUsages.customerId],
    references: [users.id],
  }),
  appointment: one(appointments, {
    fields: [couponUsages.appointmentId],
    references: [appointments.id],
  }),
  store: one(stores, {
    fields: [couponUsages.storeId],
    references: [stores.id],
  }),
}));

// Appointment Feedback Relations
export const appointmentFeedbackRelations = relations(
  appointmentFeedback,
  ({ one }) => ({
    appointment: one(appointments, {
      fields: [appointmentFeedback.appointmentId],
      references: [appointments.id],
    }),
    store: one(stores, {
      fields: [appointmentFeedback.storeId],
      references: [stores.id],
    }),
    customer: one(users, {
      fields: [appointmentFeedback.customerId],
      references: [users.id],
    }),
    staff: one(staffMembers, {
      fields: [appointmentFeedback.staffId],
      references: [staffMembers.id],
    }),
    service: one(services, {
      fields: [appointmentFeedback.serviceId],
      references: [services.id],
    }),
  }),
);
