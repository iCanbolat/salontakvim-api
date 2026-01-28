import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import Redis, { RedisOptions } from 'ioredis';
import { REDIS_CLIENT, REDIS_OPTIONS } from './redis.constants';

@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: REDIS_OPTIONS,
      inject: [ConfigService],
      useFactory: (configService: ConfigService): RedisOptions => {
        const redisUrl = configService.get<string>('REDIS_URL');
        let host = configService.get<string>('REDIS_HOST') ?? 'localhost';
        let port = Number(configService.get<string>('REDIS_PORT') ?? 6379);
        let password = configService.get<string>('REDIS_PASSWORD') ?? undefined;

        if (redisUrl) {
          try {
            const parsed = new URL(redisUrl);
            host = parsed.hostname || host;
            port = parsed.port ? Number(parsed.port) : port;
            password = parsed.password || password;
          } catch {
            // Ignore invalid URL; fallback to host/port/password
          }
        }

        return {
          host,
          port,
          password: password || undefined,
          lazyConnect: true,
          maxRetriesPerRequest: null,
        };
      },
    },
    {
      provide: REDIS_CLIENT,
      inject: [REDIS_OPTIONS],
      useFactory: (options: RedisOptions) => new Redis(options),
    },
  ],
  exports: [REDIS_OPTIONS, REDIS_CLIENT],
})
export class RedisModule {}
