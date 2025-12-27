import { Module } from '@nestjs/common';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './services/analytics.service';
import { AnalyticsExportService } from './services/analytics-export.service';
import { AnalyticsRepository } from './repositories/analytics.repository';
import { DrizzleModule } from '../db/drizzle.module';
import { AuthModule } from '../auth/auth.module';
import { StoreModule } from '../stores/store.module';

@Module({
  imports: [DrizzleModule, AuthModule, StoreModule],
  controllers: [AnalyticsController],
  providers: [AnalyticsService, AnalyticsExportService, AnalyticsRepository],
  exports: [AnalyticsService, AnalyticsExportService, AnalyticsRepository],
})
export class AnalyticsModule {}
