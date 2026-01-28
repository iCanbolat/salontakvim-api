import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { createHash } from 'crypto';
import { WidgetSettingsRepository } from '../../widget/repositories/widget-settings.repository';
import { StoreRepository } from '../../stores/repositories/store.repository';
import { NotificationService } from '../../notifications/services/notification.service';
import { REDIS_CLIENT } from '../../redis/redis.constants';

/**
 * Lightweight in-memory rate limiter for public widget endpoints.
 * Limits requests per IP+route within a sliding window.
 */
@Injectable()
export class PublicRateLimitGuard implements CanActivate {
  private readonly windowMs: number;
  private readonly maxRequests: number;
  private readonly maxWriteRequests: number;
  private readonly blockTtlMs: number;
  private readonly auditTtlMs: number;
  private readonly hits = new Map<string, number[]>();

  constructor(
    private readonly configService: ConfigService,
    private readonly widgetSettingsRepository: WidgetSettingsRepository,
    private readonly storeRepository: StoreRepository,
    private readonly notificationService: NotificationService,
    @Inject(REDIS_CLIENT) private readonly redis?: Redis,
  ) {
    this.windowMs = Number(
      this.configService.get<string>('PUBLIC_RATE_LIMIT_WINDOW_MS') || '60000',
    );
    this.maxRequests = Number(
      this.configService.get<string>('PUBLIC_RATE_LIMIT_MAX') || '120',
    );
    this.maxWriteRequests = Number(
      this.configService.get<string>('PUBLIC_RATE_LIMIT_WRITE_MAX') || '30',
    );
    this.blockTtlMs = Number(
      this.configService.get<string>('PUBLIC_WIDGET_BLOCK_TTL_SECONDS') ||
        '3600',
    ) * 1000;
    this.auditTtlMs = Number(
      this.configService.get<string>('PUBLIC_WIDGET_AUDIT_TTL_SECONDS') ||
        '300',
    ) * 1000;

  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const ip = this.getClientIp(request);
    const route = request.route?.path || request.url || 'unknown';
    const storeKey = request.params?.slug || request.params?.widgetKey || 'unknown';
    const token = request.query?.token as string | undefined;
    const tokenHash = this.hashToken(token);
    const key = `public_rl:${route}:${storeKey}:${tokenHash}:${ip}`;
    const maxForRoute = this.isWriteMethod(request.method)
      ? this.maxWriteRequests
      : this.maxRequests;

    if (this.redis) {
      const count = await this.incrementRedis(key, this.windowMs);
      if (count > maxForRoute) {
        await this.blockWidgetAccess(request, ip, route);
        throw new HttpException(
          'Too many requests. Please slow down and try again shortly.',
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }

      return true;
    }

    return this.applyInMemoryLimit(key, maxForRoute);
  }

  private getClientIp(request: any): string {
    const xfwd = request.headers?.['x-forwarded-for'];
    if (typeof xfwd === 'string' && xfwd.length) {
      const first = xfwd.split(',')[0]?.trim();
      if (first) return first;
    }
    return request.ip || request.connection?.remoteAddress || 'unknown';
  }

  private isWriteMethod(method?: string) {
    const upper = (method || '').toUpperCase();
    return ['POST', 'PUT', 'PATCH', 'DELETE'].includes(upper);
  }

  private hashToken(token?: string): string {
    if (!token) {
      return 'no-token';
    }
    return createHash('sha256').update(token).digest('hex').slice(0, 16);
  }

  private applyInMemoryLimit(key: string, max: number): boolean {
    const now = Date.now();
    const windowStart = now - this.windowMs;

    const timestamps = (this.hits.get(key) || []).filter(
      (ts) => ts >= windowStart,
    );
    timestamps.push(now);
    this.hits.set(key, timestamps);

    if (timestamps.length > max) {
      throw new HttpException(
        'Too many requests. Please slow down and try again shortly.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    if (!timestamps.length) {
      this.hits.delete(key);
    }

    return true;
  }

  private async blockWidgetAccess(
    request: any,
    ip: string,
    route: string,
  ): Promise<void> {
    if (!this.redis || this.blockTtlMs <= 0) {
      return;
    }

    const slug = request.params?.slug as string | undefined;
    const widgetKey = request.params?.widgetKey as string | undefined;
    if (!slug && !widgetKey) {
      return;
    }

    const payload = JSON.stringify({
      blockedAt: new Date().toISOString(),
      reason: 'rate_limit_exceeded',
      route,
      sourceIp: ip,
    });

    const pipeline = this.redis.multi();
    if (widgetKey) {
      pipeline.set(
        `public_widget_block:widgetKey:${widgetKey}`,
        payload,
        'PX',
        this.blockTtlMs,
      );
    }
    if (slug) {
      pipeline.set(
        `public_widget_block:slug:${slug}`,
        payload,
        'PX',
        this.blockTtlMs,
      );
    }

    await pipeline.exec();
    await this.sendAuditAlert(slug, widgetKey, ip, route);
  }

  private async sendAuditAlert(
    slug: string | undefined,
    widgetKey: string | undefined,
    ip: string,
    route: string,
  ) {
    if (!this.redis) {
      return;
    }

    const storeId = await this.resolveStoreId(slug, widgetKey);
    if (!storeId) {
      return;
    }

    const dedupeKey = `public_widget_audit:rate_limit:${storeId}`;
    if (this.auditTtlMs > 0) {
      const set = await this.redis.set(
        dedupeKey,
        String(Date.now()),
        'PX',
        this.auditTtlMs,
        'NX',
      );
      if (!set) {
        return;
      }
    }

    const store = await this.storeRepository.findById(storeId);
    if (!store?.ownerId) {
      return;
    }

    await this.notificationService.createInAppNotification(
      store.ownerId,
      storeId,
      'Widget güvenlik uyarısı',
      'Widget endpointlerinde rate-limit aşıldı. Erişim geçici olarak bloklandı.',
      'security',
      {
        reason: 'rate_limit_exceeded',
        route,
        ip,
        slug,
        widgetKey,
      },
    );
  }

  private async resolveStoreId(
    slug: string | undefined,
    widgetKey: string | undefined,
  ) {
    if (slug) {
      const store = await this.storeRepository.findBySlug(slug);
      return store?.id;
    }

    if (widgetKey) {
      const settings = await this.widgetSettingsRepository.findByWidgetKey(
        widgetKey,
      );
      return settings?.storeId;
    }

    return undefined;
  }

  private async incrementRedis(key: string, windowMs: number): Promise<number> {
    try {
      if (this.redis?.status === 'end') {
        return 0;
      }
      if (this.redis?.status === 'wait') {
        await this.redis.connect();
      }

      const pipeline = this.redis?.multi();
      pipeline?.incr(key);
      pipeline?.pexpire(key, windowMs);
      const results = await pipeline?.exec();
      const count = Number(results?.[0]?.[1] ?? 0);
      return count;
    } catch {
      return 0;
    }
  }
}
