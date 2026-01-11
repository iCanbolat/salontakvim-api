import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';

/**
 * Lightweight in-memory rate limiter for public widget endpoints.
 * Limits requests per IP+route within a sliding window.
 */
@Injectable()
export class PublicRateLimitGuard implements CanActivate {
  private readonly windowMs = 60_000; // 1 minute window
  private readonly maxRequests = 120; // per IP per route per window
  private readonly hits = new Map<string, number[]>();

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const ip = this.getClientIp(request);
    const route = request.route?.path || request.url || 'unknown';
    const key = `${ip}:${route}`;

    const now = Date.now();
    const windowStart = now - this.windowMs;

    const timestamps = (this.hits.get(key) || []).filter(
      (ts) => ts >= windowStart,
    );
    timestamps.push(now);
    this.hits.set(key, timestamps);

    if (timestamps.length > this.maxRequests) {
      throw new HttpException(
        'Too many requests. Please slow down and try again shortly.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // Optional cleanup to keep map small
    if (!timestamps.length) {
      this.hits.delete(key);
    }

    return true;
  }

  private getClientIp(request: any): string {
    const xfwd = request.headers?.['x-forwarded-for'];
    if (typeof xfwd === 'string' && xfwd.length) {
      const first = xfwd.split(',')[0]?.trim();
      if (first) return first;
    }
    return request.ip || request.connection?.remoteAddress || 'unknown';
  }
}
