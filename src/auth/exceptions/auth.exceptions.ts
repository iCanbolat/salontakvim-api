import {
  UnauthorizedException,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';

/**
 * Thrown when user provides invalid login credentials
 */
export class InvalidCredentialsException extends UnauthorizedException {
  constructor() {
    super('Geçersiz email veya şifre');
  }
}

/**
 * Thrown when attempting to register with an email that already exists
 */
export class EmailAlreadyExistsException extends ConflictException {
  constructor(email: string) {
    super(`Bu email adresi zaten kayıtlı: ${email}`);
  }
}

/**
 * Thrown when a user cannot be found by ID or email
 */
export class UserNotFoundException extends NotFoundException {
  constructor(identifier: string) {
    super(`Kullanıcı bulunamadı: ${identifier}`);
  }
}

/**
 * Thrown when refresh token is invalid or expired
 */
export class InvalidRefreshTokenException extends UnauthorizedException {
  constructor() {
    super('Geçersiz veya süresi dolmuş refresh token');
  }
}

/**
 * Thrown when refresh token is not found in database
 */
export class RefreshTokenNotFoundException extends NotFoundException {
  constructor(tokenId: string) {
    super(`Refresh token bulunamadı: ${tokenId}`);
  }
}

/**
 * Thrown when user account is inactive
 */
export class InactiveAccountException extends ForbiddenException {
  constructor() {
    super('Hesabınız aktif değil. Lütfen yönetici ile iletişime geçin');
  }
}

/**
 * Thrown when social authentication fails
 */
export class InvalidSocialAuthException extends BadRequestException {
  constructor(provider: string, reason?: string) {
    super(`${provider} ile giriş başarısız${reason ? `: ${reason}` : ''}`);
  }
}

/**
 * Thrown when user attempts to access a protected resource without proper authentication
 */
export class UnauthorizedAccessException extends UnauthorizedException {
  constructor(resource?: string) {
    super(
      resource
        ? `Bu kaynağa erişim için yetkiniz yok: ${resource}`
        : 'Bu işlem için giriş yapmanız gerekiyor',
    );
  }
}

/**
 * Thrown when user doesn't have required role/permission
 */
export class InsufficientPermissionsException extends ForbiddenException {
  constructor(requiredRole?: string) {
    super(
      requiredRole
        ? `Bu işlem için '${requiredRole}' yetkisi gerekiyor`
        : 'Bu işlem için yetkiniz bulunmuyor',
    );
  }
}

/**
 * Thrown when password reset token is invalid or expired
 */
export class InvalidPasswordResetTokenException extends BadRequestException {
  constructor() {
    super('Geçersiz veya süresi dolmuş şifre sıfırlama bağlantısı');
  }
}
