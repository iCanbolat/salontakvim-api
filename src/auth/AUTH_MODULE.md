# Auth Module - API Documentation

## Overview

Clean architecture ve repository pattern ile oluşturulmuş authentication modülü. JWT token-based authentication ve social login desteği sağlar.

## Features

- ✅ Local authentication (email/password)
- ✅ Social authentication (Google, Facebook, Apple)
- ✅ JWT access & refresh tokens
- ✅ Role-based access control (Admin, Staff, Customer)
- ✅ Global JWT guard with @Public decorator
- ✅ Clean architecture with repository pattern
- ✅ Password hashing with bcrypt
- ✅ Input validation with class-validator

## Architecture

```
src/auth/
├── controllers/
│   └── auth.controller.ts          # REST endpoints
├── services/
│   └── auth.service.ts             # Business logic
├── repositories/
│   ├── user.repository.ts          # User data access
│   └── refresh-token.repository.ts # Token data access
├── strategies/
│   ├── jwt.strategy.ts             # JWT validation
│   └── local.strategy.ts           # Local auth validation
├── guards/
│   ├── jwt-auth.guard.ts           # JWT authentication guard
│   ├── local-auth.guard.ts         # Local login guard
│   └── roles.guard.ts              # Role-based authorization
├── decorators/
│   ├── current-user.decorator.ts   # Get current user
│   ├── roles.decorator.ts          # Set required roles
│   └── public.decorator.ts         # Mark routes as public
├── dto/
│   └── auth.dto.ts                 # Request/response DTOs
├── interfaces/
│   ├── auth.interface.ts           # Auth types
│   └── repository.interface.ts    # Repository contracts
└── auth.module.ts                  # Module configuration
```

## API Endpoints

### Public Endpoints

#### POST /api/auth/register

Register a new user (default: admin role, freemium status)

**Request:**

```json
{
  "email": "user@example.com",
  "password": "password123",
  "firstName": "John",
  "lastName": "Doe",
  "phone": "+1234567890"
}
```

**Response:**

```json
{
  "user": {
    "id": 1,
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "role": "admin",
    "paymentStatus": "freemium",
    "avatar": null
  },
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

#### POST /api/auth/login

Login with email and password

**Request:**

```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response:** Same as register

#### POST /api/auth/social-auth

Social login (Google, Facebook, Apple)

**Request:**

```json
{
  "email": "user@example.com",
  "providerId": "google_user_id_123",
  "provider": "google",
  "firstName": "John",
  "lastName": "Doe",
  "avatar": "https://example.com/avatar.jpg"
}
```

**Response:** Same as register

#### POST /api/auth/refresh

Refresh access token

**Request:**

```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

**Response:** Same as register with new tokens

### Protected Endpoints (Require JWT)

#### POST /api/auth/logout

Logout from current device

**Headers:**

```
Authorization: Bearer <access_token>
```

**Request:**

```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

#### POST /api/auth/logout-all

Logout from all devices

**Headers:**

```
Authorization: Bearer <access_token>
```

#### GET /api/auth/me

Get current user profile

**Headers:**

```
Authorization: Bearer <access_token>
```

**Response:**

```json
{
  "user": {
    "id": 1,
    "email": "user@example.com",
    "role": "admin",
    "paymentStatus": "freemium"
  }
}
```

## Usage Examples

### Protecting Routes

By default, all routes require JWT authentication due to global guard.

#### Make a route public:

```typescript
@Public()
@Get('public-endpoint')
getPublicData() {
  return { data: 'This is public' };
}
```

#### Get current user in controller:

```typescript
@Get('profile')
getProfile(@CurrentUser() user: any) {
  return { user };
}

@Get('user-id')
getUserId(@CurrentUser('id') userId: number) {
  return { userId };
}
```

#### Require specific roles:

```typescript
@Roles('admin', 'staff')
@UseGuards(JwtAuthGuard, RolesGuard)
@Get('admin-only')
getAdminData() {
  return { data: 'Admin only' };
}
```

### Service Layer

```typescript
import { AuthService } from './auth/services/auth.service';

constructor(private authService: AuthService) {}

async someMethod() {
  const tokens = await this.authService.register(registerDto);
  const user = await this.authService.validateUser(email, password);
}
```

### Repository Layer

```typescript
import { UserRepository } from './auth/repositories/user.repository';

constructor(private userRepository: UserRepository) {}

async someMethod() {
  const user = await this.userRepository.findByEmail('user@example.com');
  const newUser = await this.userRepository.create(userData);
}
```

## Environment Variables

```env
JWT_SECRET=your-super-secret-jwt-key
JWT_REFRESH_TOKEN_SECRET=your-super-secret-refresh-token-key
JWT_ACCESS_TOKEN_EXPIRATION=15m
JWT_REFRESH_TOKEN_EXPIRATION=7d
```

## User Roles

- **admin**: Store owner, full access (default for new registrations)
- **staff**: Employee, limited access to assigned appointments
- **customer**: No dashboard access, created via widget bookings

## Payment Status

- **freemium**: Free tier, limited features (default)
- **paid**: Premium tier, full access

## Security Features

- Passwords hashed with bcrypt (salt rounds: 10)
- JWT tokens with expiration
- Refresh token rotation
- Last login tracking
- Account activation/deactivation
- Email verification support
- Multiple device logout support

## Testing with cURL

### Register

```bash
curl -X POST http://localhost:8080/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123",
    "firstName": "Test",
    "lastName": "User"
  }'
```

### Login

```bash
curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123"
  }'
```

### Get Profile

```bash
curl -X GET http://localhost:8080/api/auth/me \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

## Error Handling

- `400 Bad Request`: Invalid input data
- `401 Unauthorized`: Invalid credentials or expired token
- `409 Conflict`: User already exists
- `500 Internal Server Error`: Server error

## Next Steps

- [ ] Email verification implementation
- [ ] Password reset flow
- [ ] Rate limiting
- [ ] 2FA support
- [ ] Audit logs
- [ ] Social login OAuth flows
