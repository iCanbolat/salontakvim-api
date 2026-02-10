import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { FeedbackService } from './services/feedback.service';
import {
  CreateFeedbackDto,
  UpdateFeedbackDto,
  GetStoreFeedbackDto,
  GetPublicFeedbackDto,
} from './dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { Public } from '../auth/decorators/public.decorator';
import type { JwtPayload } from '../auth/interfaces/auth.interface';

@Controller('stores/:storeId/feedback')
export class FeedbackController {
  constructor(private readonly feedbackService: FeedbackService) {}

  /**
   * Public feedback submission endpoint for completed appointments
   * No authentication required - validates token, appointment exists and is completed
   */
  @Post('submit')
  @Public()
  @HttpCode(HttpStatus.CREATED)
  async submitPublicFeedback(
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Body() dto: CreateFeedbackDto & { token?: string },
  ) {
    return this.feedbackService.createPublic(storeId, dto);
  }

  /**
   * Check if feedback can be submitted for an appointment (public)
   */
  @Get('check/:appointmentId')
  @Public()
  async checkFeedbackStatus(
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Param('appointmentId', ParseUUIDPipe) appointmentId: string,
    @Query('token') token?: string,
  ) {
    return this.feedbackService.checkFeedbackStatus(
      storeId,
      appointmentId,
      token,
    );
  }

  @Post()
  @Roles('admin', 'manager', 'staff', 'customer')
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateFeedbackDto,
  ) {
    return this.feedbackService.create(storeId, dto, user.sub);
  }

  @Get('dashboard')
  @Roles('admin', 'manager', 'staff')
  async getDashboard(
    // Relax UUID parsing here to avoid false negatives in edge cases
    @Param('storeId') storeId: string,
    @CurrentUser() user: JwtPayload,
    @Query() query: GetStoreFeedbackDto,
  ) {
    return this.feedbackService.getDashboard(storeId, user.sub, user.role, {
      staffId: query.staffId,
      serviceId: query.serviceId,
      search: query.search,
      page: query.page,
      limit: query.limit,
    });
  }

  @Get()
  @Roles('admin', 'manager', 'staff')
  async findAll(
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @CurrentUser() user: JwtPayload,
    @Query() query: GetStoreFeedbackDto,
  ) {
    return this.feedbackService.findAll(storeId, user.sub, {
      customerId: query.customerId,
      staffId: query.staffId,
      serviceId: query.serviceId,
      search: query.search,
      page: query.page,
      limit: query.limit,
    });
  }

  @Get('public')
  @Public()
  async getPublicFeedback(
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Query() query: GetPublicFeedbackDto,
  ) {
    return this.feedbackService.getPublicFeedback(storeId, {
      staffId: query.staffId,
      serviceId: query.serviceId,
      limit: query.limit ?? 10,
      offset: query.page ? (query.page - 1) * (query.limit ?? 10) : undefined,
    });
  }

  @Get('appointment/:appointmentId')
  @Roles('admin', 'manager', 'staff')
  async getByAppointmentId(
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Param('appointmentId', ParseUUIDPipe) appointmentId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.feedbackService.findByAppointmentId(
      storeId,
      appointmentId,
      user.sub,
    );
  }

  @Get('stats')
  @Roles('admin', 'manager', 'staff')
  async getStats(
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @CurrentUser() user: JwtPayload,
    @Query('staffId') staffId?: string,
    @Query('serviceId') serviceId?: string,
  ) {
    return this.feedbackService.getStats(storeId, user.sub, staffId, serviceId);
  }

  @Get('stats/public')
  @Public()
  async getPublicStats(@Param('storeId', ParseUUIDPipe) storeId: string) {
    return this.feedbackService.getPublicStats(storeId);
  }

  @Get(':feedbackId')
  @Roles('admin', 'manager', 'staff')
  async findById(
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Param('feedbackId', ParseUUIDPipe) feedbackId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.feedbackService.findById(storeId, feedbackId, user.sub);
  }

  @Patch(':feedbackId')
  @Roles('admin', 'manager', 'staff', 'customer')
  async update(
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Param('feedbackId', ParseUUIDPipe) feedbackId: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateFeedbackDto,
  ) {
    return this.feedbackService.update(storeId, feedbackId, user.sub, dto);
  }

  @Delete(':feedbackId')
  @Roles('admin', 'manager', 'staff', 'customer')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Param('feedbackId', ParseUUIDPipe) feedbackId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.feedbackService.delete(storeId, feedbackId, user.sub);
  }
}
