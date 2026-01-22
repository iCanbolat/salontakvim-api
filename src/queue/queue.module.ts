/**
 * Queue Module
 * Configures BullMQ for background job processing
 */

import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';

export const FEEDBACK_QUEUE = 'feedback';
export const NOTIFICATION_QUEUE = 'notifications';

@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const host = configService.get<string>('REDIS_HOST') ?? 'localhost';
        const port = Number(configService.get('REDIS_PORT') ?? 6379);
        const password =
          (configService.get<string>('REDIS_PASSWORD') as string | undefined) ??
          undefined;

        return {
          connection: {
            host,
            port,
            password,
          },
          defaultJobOptions: {
            removeOnComplete: 100,
            removeOnFail: 1000,
            attempts: 3,
            backoff: {
              type: 'exponential',
              delay: 1000,
            },
          },
        };
      },
    }),
    BullModule.registerQueue(
      { name: FEEDBACK_QUEUE },
      { name: NOTIFICATION_QUEUE },
    ),
  ],
  exports: [BullModule],
})
export class QueueModule {}
