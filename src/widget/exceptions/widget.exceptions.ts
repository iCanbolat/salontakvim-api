import {
  NotFoundException,
  BadRequestException,
  ConflictException,
  InternalServerErrorException,
  ForbiddenException,
} from '@nestjs/common';

/**
 * Thrown when widget settings cannot be found for a store
 */
export class WidgetSettingsNotFoundException extends NotFoundException {
  constructor(storeId: string) {
    super(`Widget ayarları bulunamadı. Store ID: ${storeId}`);
  }
}

/**
 * Thrown when widget key is invalid
 */
export class InvalidWidgetKeyException extends BadRequestException {
  constructor() {
    super('Geçersiz widget anahtarı');
  }
}

/**
 * Thrown when widget key is not found in database
 */
export class WidgetKeyNotFoundException extends NotFoundException {
  constructor(widgetKey: string) {
    super(`Widget anahtarı bulunamadı: ${widgetKey}`);
  }
}

/**
 * Thrown when widget configuration is invalid
 */
export class InvalidWidgetConfigurationException extends BadRequestException {
  constructor(reason: string) {
    super(`Geçersiz widget yapılandırması: ${reason}`);
  }
}

/**
 * Thrown when widget color format is invalid
 */
export class InvalidWidgetColorException extends BadRequestException {
  constructor(colorField: string, value: string) {
    super(
      `Geçersiz renk formatı (${colorField}): ${value}. HEX formatı kullanın (#RRGGBB)`,
    );
  }
}

/**
 * Thrown when widget font is invalid
 */
export class InvalidWidgetFontException extends BadRequestException {
  constructor(font: string) {
    super(`Geçersiz font: ${font}`);
  }
}

/**
 * Thrown when widget layout option is invalid
 */
export class InvalidWidgetLayoutException extends BadRequestException {
  constructor(layout: string) {
    super(`Geçersiz widget düzeni: ${layout}`);
  }
}

/**
 * Thrown when widget menu items configuration is invalid
 */
export class InvalidWidgetMenuItemsException extends BadRequestException {
  constructor(reason: string) {
    super(`Geçersiz menü yapılandırması: ${reason}`);
  }
}

/**
 * Thrown when widget is disabled for the store
 */
export class WidgetDisabledException extends ForbiddenException {
  constructor(storeId: string) {
    super(`Widget bu mağaza için devre dışı. Store ID: ${storeId}`);
  }
}

/**
 * Thrown when widget key regeneration fails
 */
export class WidgetKeyRegenerationFailedException extends InternalServerErrorException {
  constructor(reason?: string) {
    super(`Widget anahtarı yenilenemedi${reason ? `: ${reason}` : ''}`);
  }
}

/**
 * Thrown when embed code generation fails
 */
export class EmbedCodeGenerationFailedException extends InternalServerErrorException {
  constructor(reason?: string) {
    super(`Embed kodu oluşturulamadı${reason ? `: ${reason}` : ''}`);
  }
}

/**
 * Thrown when widget redirect URL is invalid
 */
export class InvalidWidgetRedirectUrlException extends BadRequestException {
  constructor(url: string) {
    super(`Geçersiz yönlendirme URL'si: ${url}`);
  }
}
