# Database Schema - Multi-Tenant Appointment Booking SaaS

## Overview

This is a **multi-tenant SaaS application** where each **Store** represents a business (salon, spa, clinic, etc.). The system supports three user roles:

- **Admin**: Store owner who manages the entire business
- **Staff**: Employees who can view and manage their assigned appointments
- **Customer**: People who book appointments (no login required, data stored via widget submissions)

## Architecture

### Multi-Tenancy Model

- Each admin creates a **Store** upon registration (freemium by default)
- All business entities (services, locations, staff, appointments) belong to a store via `storeId`
- Staff members are invited via invitation links and assigned to a store
- Customers are created/updated automatically when booking via the widget

## Core Tables

### 1. Users

Main user table for all user types (admin, staff, customer).

**Key Points:**

- `role`: 'admin' | 'staff' | 'customer'
- `password`: Optional for customers (no dashboard access)
- `paymentStatus`: 'freemium' | 'paid' (only applies to admins)
- Supports social login (Google, Facebook, Apple)
- Every registered user is 'admin' by default with 'freemium' status

### 2. Stores

Represents a business/tenant in the SaaS platform.

**Key Points:**

- Each store has one owner (admin user)
- Contains store metadata: name, slug, logo, business type
- Tracks analytics: total appointments, revenue, customers
- Multiple locations (branches) can belong to one store
- Has timezone and currency settings

### 3. Staff Invitations

System for inviting staff members to join a store.

**Key Points:**

- Admin creates invite link with email
- Token-based invitation system
- Status: pending | accepted | expired | cancelled
- Once accepted, creates staff member record

### 4. Staff Members

Staff users assigned to a store.

**Key Points:**

- Links `users` (with role='staff') to a `store`
- Can be assigned to specific location (branch)
- Has working hours and break schedules
- Can be assigned to multiple services

### 5. Categories

Service categories (e.g., "Haircut", "Massage", "Facial").

**Key Points:**

- Belongs to a store
- Has color, icon, position for UI customization
- Groups related services

### 6. Locations

Physical branches/locations of a store.

**Key Points:**

- Multiple locations per store (e.g., downtown branch, mall branch)
- Contains full address with geocoding (latitude/longitude)
- Staff members can be assigned to specific locations
- Services can be offered at specific locations

### 7. Services

Services/treatments offered by the store.

**Key Points:**

- Belongs to store and optionally a category
- Duration, price, capacity settings
- Buffer time before/after appointments
- Can allow bringing additional people
- Supports recurring appointments
- Has many-to-many relations with staff and locations

### 8. Service Extras

Additional services/add-ons (e.g., "Head massage", "Special product").

**Key Points:**

- Belongs to a service
- Has additional price and duration
- Max quantity per appointment

### 9. Appointments

Core booking records.

**Key Points:**

- Belongs to a store
- Can link to registered customer or store guest info
- Links service, staff, location
- Status: pending | confirmed | cancelled | completed | no_show
- Payment tracking (isPaid, paymentMethod, totalPrice)
- Customer notes (visible) vs internal notes (staff only)
- Supports recurring appointments

### 10. Widget Settings

Customization settings for the embeddable booking widget.

**Key Points:**

- One per store
- Layout options: list | steps (Amelia-style)
- Sidebar menu items configuration (which steps to show)
- Field requirements (which fields are required)
- Complete color customization (primary, sidebar, background, text)
- Typography settings (font family, size)
- Unique widget key for embedding
- Guest booking toggle

### 11. Custom Fields

Dynamic form fields for services.

**Key Points:**

- Store-level or service-specific
- Types: text, textarea, select, checkbox, radio, date, file
- Optional with configurable requirements
- Values stored in appointment_custom_field_values

## Supporting Tables

- **refresh_tokens**: JWT refresh tokens for authentication
- **service_staff**: Many-to-many relationship between services and staff
- **service_locations**: Many-to-many relationship between services and locations
- **staff_working_hours**: Weekly schedule for each staff member
- **staff_breaks**: Time off / breaks for staff
- **appointment_extras**: Selected extras for each appointment
- **appointment_custom_field_values**: Values for custom fields per appointment

## Key Relationships

```
User (admin) → owns → Store
Store → has many → Locations (branches)
Store → has many → Staff Members
Store → has many → Services
Store → has many → Appointments
Store → has one → Widget Settings

Staff Member → belongs to → Store
Staff Member → optionally assigned to → Location
Staff Member → can serve → many Services (M:M)

Service → belongs to → Store
Service → belongs to → Category
Service → offered at → many Locations (M:M)
Service → served by → many Staff Members (M:M)

Appointment → belongs to → Store
Appointment → booked by → Customer (or guest)
Appointment → for → Service
Appointment → with → Staff Member
Appointment → at → Location
```

## User Flows

### Admin Registration Flow

1. User registers → role='admin', paymentStatus='freemium'
2. Store automatically created with owner=user
3. Widget settings initialized with default values
4. Admin can now add services, locations, invite staff

### Staff Invitation Flow

1. Admin creates staff invitation with email
2. Invitation link sent with unique token
3. Staff registers/logs in via invite link
4. User created with role='staff'
5. Staff member record created linking to store
6. Invitation status updated to 'accepted'

### Customer Booking Flow (No Login)

1. Customer fills widget on store's website
2. System checks if email exists:
   - If exists: Link appointment to existing customer
   - If new: Create user with role='customer', no password
3. Appointment created with all details
4. Email confirmation sent

### Staff View Appointments

1. Staff logs in (JWT authentication)
2. Can only view appointments where staffId = their staff member ID
3. Can cancel appointments assigned to them

### Admin Dashboard

1. Admin logs in
2. Views all appointments for their store
3. Views all customer data
4. Can see staff calendars
5. Analytics: revenue, customer count, appointment stats

## Payment & Subscription

- `paymentStatus` on `users` table (admin only)
- 'freemium': Limited features/appointments
- 'paid': Full access (implement limits in business logic)

## Authentication Strategy

- JWT token-based authentication
- Refresh token rotation for security
- Social login support (Google, Facebook, Apple)
- Customers don't need passwords (booking only via widget)
- Staff and Admin require password/social login

## Widget Embed System

- Each store gets unique `widgetKey`
- Widget customizable: colors, fonts, layout, required fields
- Can be embedded via iframe or JavaScript SDK
- Sidebar menu configurable (show/hide: service, employee, location, extras, etc.)

## Indexes

Optimized indexes for:

- User lookups by email and role
- Store lookups by slug
- Appointment queries by store, staff, customer, date, status
- Multi-tenant data isolation (storeId indexes on all tables)

## Notes

- All timestamps use `timestamp` type with `defaultNow()`
- Prices stored as `decimal(10, 2)` for precision
- Soft deletes not implemented (use `isActive`/`isVisible` flags instead)
- Guest customer data embedded in appointments table
- Relations defined for optimal Drizzle ORM queries

## Changes from Original Design

### Before (Single-Tenant)

- `userId` on all tables → each admin managed their own data separately
- No concept of stores/business entities
- Staff directly owned by admin user

### After (Multi-Tenant SaaS)

- `storeId` on all tables → data grouped by store
- **Store** is the core business entity
- Staff belongs to store, not individual admin
- Locations are now branches of a store
- Analytics tracked at store level
- Each store gets unique widget
- Staff invitation system added
- Clear separation: Admin owns store, Staff works at store, Customer books at store
