/**
 * Queue Module
 * Configures BullMQ for background job processing
 */

import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { RedisOptions } from 'ioredis';
import { RedisModule } from '../redis/redis.module';
import { REDIS_OPTIONS } from '../redis/redis.constants';

export const FEEDBACK_QUEUE = 'feedback';
export const NOTIFICATION_QUEUE = 'notifications';

@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [RedisModule],
      inject: [REDIS_OPTIONS],
      useFactory: (redisOptions: RedisOptions) => {
        return {
          connection: {
            ...redisOptions,
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
