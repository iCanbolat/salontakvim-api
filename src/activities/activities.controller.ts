import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ActivitiesService } from './services/activities.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/interfaces/auth.interface';

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
export class ActivitiesController {
  constructor(private readonly activitiesService: ActivitiesService) {}

  @Get('stores/:storeId/activities')
  @Roles('admin', 'manager', 'staff')
  async getRecentActivities(
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Query('limit') limit?: string,
    @Query('page') page?: string,
    @Query('type') type?: string,
    @Query('status') status?: string,
    @Query('locationId') locationId?: string,
    @CurrentUser() user?: JwtPayload,
  ) {
    const parsedLimitRaw = Number.parseInt(limit ?? '', 10);
    const parsedLimit = Number.isFinite(parsedLimitRaw)
      ? Math.max(1, Math.min(parsedLimitRaw, 50))
      : 10;

    const parsedPageRaw = Number.parseInt(page ?? '', 10);
    const parsedPage = Number.isFinite(parsedPageRaw)
      ? Math.max(1, parsedPageRaw)
      : undefined;

    const resolvedType = type || status;
    const resolvedLocationId =
      user?.role === 'manager' ? user.locationId : locationId;

    if (parsedPage || resolvedType) {
      return this.activitiesService.getActivitiesPaginated(
        storeId,
        parsedPage ?? 1,
        parsedLimit,
        resolvedType,
        resolvedLocationId,
      );
    }

    return this.activitiesService.getRecentActivities(
      storeId,
      parsedLimit,
      resolvedLocationId,
    );
  }
}
