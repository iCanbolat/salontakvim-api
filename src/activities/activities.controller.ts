import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ActivitiesService } from './services/activities.service';

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
export class ActivitiesController {
  constructor(private readonly activitiesService: ActivitiesService) {}

  @Get('stores/:storeId/activities')
  @Roles('admin', 'staff')
  async getRecentActivities(
    @Param('storeId', ParseIntPipe) storeId: number,
    @Query('limit') limit?: string,
  ) {
    const parsed = Number.parseInt(limit ?? '', 10);
    const parsedLimit = Number.isFinite(parsed)
      ? Math.max(1, Math.min(parsed, 50))
      : 20;

    return this.activitiesService.getRecentActivities(storeId, parsedLimit);
  }
}
