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
  private readonly maxInMemoryKeys: number;
  private readonly sweepIntervalMs: number;
  private readonly hits = new Map<
    string,
    { timestamps: number[]; lastSeen: number }
  >();
  private lastSweepAt = 0;

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
    this.blockTtlMs =
      Number(
        this.configService.get<string>('PUBLIC_WIDGET_BLOCK_TTL_SECONDS') ||
          '3600',
      ) * 1000;
    this.auditTtlMs =
      Number(
        this.configService.get<string>('PUBLIC_WIDGET_AUDIT_TTL_SECONDS') ||
          '300',
      ) * 1000;
    this.maxInMemoryKeys = Number(
      this.configService.get<string>('PUBLIC_RATE_LIMIT_INMEMORY_MAX_KEYS') ||
        '50000',
    );
    this.sweepIntervalMs = Number(
      this.configService.get<string>('PUBLIC_RATE_LIMIT_INMEMORY_SWEEP_MS') ||
        '60000',
    );
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const ip = this.getClientIp(request);
    const route = request.route?.path || request.url || 'unknown';
    const storeKey =
      request.params?.slug || request.params?.widgetKey || 'unknown';
    const token = request.query?.token as string | undefined;
    const tokenHash = this.hashToken(token);
    const key = `public_rl:${route}:${storeKey}:${tokenHash}:${ip}`;
    const maxForRoute = this.isWriteMethod(request.method)
      ? this.maxWriteRequests
      : this.maxRequests;

    if (this.redis) {
      const count = await this.incrementRedis(key, this.windowMs);
      if (count === null) {
        if (this.isWriteMethod(request.method)) {
          throw new HttpException(
            'Rate limit backend unavailable. Please retry shortly.',
            HttpStatus.TOO_MANY_REQUESTS,
          );
        }

        return this.applyInMemoryLimit(key, maxForRoute);
      }

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
    this.sweepInMemoryHits(now);

    if (!this.hits.has(key) && this.hits.size >= this.maxInMemoryKeys) {
      this.evictOldestInMemoryKey();
    }

    const existing = this.hits.get(key);
    const timestamps = (existing?.timestamps || []).filter(
      (ts) => ts >= windowStart,
    );
    timestamps.push(now);
    this.hits.set(key, { timestamps, lastSeen: now });

    if (timestamps.length > max) {
      throw new HttpException(
        'Too many requests. Please slow down and try again shortly.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return true;
  }

  private sweepInMemoryHits(now: number) {
    if (now - this.lastSweepAt < this.sweepIntervalMs) {
      return;
    }

    this.lastSweepAt = now;
    const windowStart = now - this.windowMs;

    for (const [key, entry] of this.hits.entries()) {
      const recent = entry.timestamps.filter((ts) => ts >= windowStart);

      if (!recent.length && entry.lastSeen < windowStart) {
        this.hits.delete(key);
        continue;
      }

      if (recent.length !== entry.timestamps.length) {
        this.hits.set(key, {
          timestamps: recent,
          lastSeen: entry.lastSeen,
        });
      }
    }
  }

  private evictOldestInMemoryKey() {
    let oldestKey: string | null = null;
    let oldestSeen = Number.POSITIVE_INFINITY;

    for (const [key, entry] of this.hits.entries()) {
      if (entry.lastSeen < oldestSeen) {
        oldestSeen = entry.lastSeen;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.hits.delete(oldestKey);
    }
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
      const settings =
        await this.widgetSettingsRepository.findByWidgetKey(widgetKey);
      return settings?.storeId;
    }

    return undefined;
  }

  private async incrementRedis(
    key: string,
    windowMs: number,
  ): Promise<number | null> {
    try {
      if (this.redis?.status === 'end') {
        return null;
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
      return null;
    }
  }
}
