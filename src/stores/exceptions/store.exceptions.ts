import {
  NotFoundException,
  ConflictException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';

/**
 * Thrown when a store cannot be found by ID or slug
 */
export class StoreNotFoundException extends NotFoundException {
  constructor(identifier: string) {
    super(`Mağaza bulunamadı: ${identifier}`);
  }
}

/**
 * Thrown when attempting to create a store with a slug that already exists
 */
export class StoreSlugAlreadyExistsException extends ConflictException {
  constructor(slug: string) {
    super(`Bu slug zaten kullanımda: ${slug}`);
  }
}

/**
 * Thrown when a user tries to create a second store (one store per user rule)
 */
export class UserAlreadyHasStoreException extends ConflictException {
  constructor(userId: string) {
    super(
      `Bu kullanıcının zaten bir mağazası var. Bir kullanıcı sadece bir mağaza oluşturabilir. User ID: ${userId}`,
    );
  }
}

/**
 * Thrown when user tries to access a store they don't own
 */
export class UnauthorizedStoreAccessException extends ForbiddenException {
  constructor(storeId: string, userId: string) {
    super(
      `Bu mağazaya erişim yetkiniz yok. Store ID: ${storeId}, User ID: ${userId}`,
    );
  }
}

/**
 * Thrown when trying to perform operations on an inactive store
 */
export class StoreInactiveException extends ForbiddenException {
  constructor(storeId: string) {
    super(`Bu mağaza aktif değil. Store ID: ${storeId}`);
  }
}

/**
 * Thrown when trying to delete a store that has active dependencies
 */
export class StoreHasActiveDependenciesException extends ConflictException {
  constructor(storeId: string, dependencies: string[]) {
    super(
      `Mağaza silinemez. Aktif bağımlılıklar: ${dependencies.join(', ')}. Store ID: ${storeId}`,
    );
  }
}

/**
 * Thrown when store name is invalid (too short, too long, invalid characters)
 */
export class InvalidStoreNameException extends BadRequestException {
  constructor(reason: string) {
    super(`Geçersiz mağaza adı: ${reason}`);
  }
}

/**
 * Thrown when user reaches store creation limit
 */
export class StoreLimitReachedException extends ForbiddenException {
  constructor(userId: string, limit: number) {
    super(
      `Mağaza oluşturma limitine ulaştınız. Limit: ${limit}. User ID: ${userId}`,
    );
  }
}
