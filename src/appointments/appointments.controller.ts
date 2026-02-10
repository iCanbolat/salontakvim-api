import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  ParseUUIDPipe,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Public } from '../auth/decorators/public.decorator';
import type { JwtPayload } from '../auth/interfaces/auth.interface';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AppointmentsService } from './services/appointments.service';
import {
  CreateAppointmentDto,
  CreateGuestAppointmentDto,
  UpdateAppointmentDto,
  UpdateAppointmentStatusDto,
  GetAvailabilityDto,
  GetStoreAppointmentsDto,
} from './dto';

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
export class AppointmentsController {
  constructor(private readonly appointmentsService: AppointmentsService) {}

  // ============= Customer Endpoints =============

  @Post('stores/:storeId/appointments')
  @Roles('customer', 'admin', 'manager', 'staff')
  async createAppointment(
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Body() dto: CreateAppointmentDto,
    @CurrentUser() user: JwtPayload,
  ) {
    const hasGuestPayload = Boolean(dto.guestEmail);

    // Customers can only create appointments for themselves.
    if (user.role === 'customer' && hasGuestPayload) {
      throw new BadRequestException(
        'Guest fields are not allowed for customer appointment creation',
      );
    }

    // Admin/staff/manager may create appointments for guests by providing guest details.
    if (
      (user.role === 'admin' ||
        user.role === 'manager' ||
        user.role === 'staff') &&
      hasGuestPayload
    ) {
      if (!dto.guestFirstName || !dto.guestEmail) {
        throw new BadRequestException(
          'guestFirstName and guestEmail are required when creating a guest appointment',
        );
      }

      return await this.appointmentsService.createGuestAppointment(
        storeId,
        dto as CreateGuestAppointmentDto,
      );
    }

    return await this.appointmentsService.createAppointment(
      storeId,
      user.sub,
      dto,
    );
  }

  @Get('appointments')
  @Roles('customer')
  async getMyAppointments(@CurrentUser() user: JwtPayload) {
    return await this.appointmentsService.getMyAppointments(user.sub);
  }

  @Get('appointments/:id')
  @Roles('customer', 'admin', 'manager', 'staff')
  async getMyAppointment(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    // Note: Service should validate user owns this appointment
    const appointment = await this.appointmentsService.getAppointmentById(
      id,
      '', // Will need to get storeId from appointment
    );
    return appointment;
  }

  @Patch('appointments/:id')
  @Roles('customer')
  async updateMyAppointment(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAppointmentDto,
    @CurrentUser() user: JwtPayload,
  ) {
    // Note: Service should validate user owns this appointment
    const appointment = await this.appointmentsService.getAppointmentById(
      id,
      '',
    );
    return await this.appointmentsService.updateAppointment(
      id,
      appointment.storeId,
      dto,
    );
  }

  @Delete('appointments/:id')
  @Roles('customer')
  async cancelMyAppointment(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('reason') reason?: string,
    @CurrentUser() user?: JwtPayload,
  ) {
    return await this.appointmentsService.cancelAppointment(
      id,
      user!.sub,
      reason,
    );
  }

  // ============= Admin/Staff Endpoints =============

  @Get('stores/:storeId/appointments')
  @Roles('admin', 'manager', 'staff')
  async getStoreAppointments(
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Query() query: GetStoreAppointmentsDto,
    @CurrentUser() user: JwtPayload,
  ) {
    const resolvedQuery =
      user.role === 'manager' && user.locationId
        ? { ...query, locationId: user.locationId }
        : query;

    return await this.appointmentsService.getStoreAppointments(
      storeId,
      resolvedQuery,
    );
  }

  @Get('stores/:storeId/appointments/:id')
  @Roles('admin', 'manager', 'staff')
  async getStoreAppointment(
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return await this.appointmentsService.getAppointmentById(
      id,
      storeId,
      user.sub,
    );
  }

  @Patch('stores/:storeId/appointments/:id')
  @Roles('admin', 'manager', 'staff')
  async updateStoreAppointment(
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAppointmentDto,
  ) {
    return await this.appointmentsService.updateAppointment(id, storeId, dto);
  }

  @Patch('stores/:storeId/appointments/:id/status')
  @Roles('admin', 'manager', 'staff')
  async updateAppointmentStatus(
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAppointmentStatusDto,
  ) {
    return await this.appointmentsService.updateAppointmentStatus(
      id,
      storeId,
      dto,
    );
  }

  @Delete('stores/:storeId/appointments/:id')
  @Roles('admin')
  async deleteAppointment(
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.appointmentsService.deleteAppointment(id, storeId);
    return { message: 'Appointment deleted successfully' };
  }

  // ============= Availability Endpoints =============

  @Get('stores/:storeId/availability')
  @Public()
  async getAvailability(
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Query('serviceId', ParseUUIDPipe) serviceId: string,
    @Query('staffId', ParseUUIDPipe) staffId: string,
    @Query('date') date: string,
    @Query('locationId') locationId?: string,
    @Query('extrasDurationMinutes') extrasDurationMinutes?: string,
    @Query('excludeAppointmentId') excludeAppointmentId?: string,
  ) {
    const extrasDurationNum = extrasDurationMinutes
      ? parseInt(extrasDurationMinutes)
      : undefined;
    return await this.appointmentsService.getAvailability(
      storeId,
      serviceId,
      staffId,
      date,
      locationId,
      extrasDurationNum,
      excludeAppointmentId,
    );
  }

  @Get('public/appointments/cancel-details')
  @Public()
  async getAppointmentByToken(@Query('token') token: string) {
    return await this.appointmentsService.getAppointmentByToken(token);
  }

  @Post('public/appointments/cancel')
  @Public()
  async cancelAppointmentByToken(
    @Body() body: { token: string; reason?: string },
  ) {
    return await this.appointmentsService.cancelAppointmentByToken(
      body.token,
      body.reason,
    );
  }

  // ============= Guest Booking (Public) =============

  @Post('public/stores/:slug/appointments')
  @Public()
  async createGuestAppointment(
    @Param('slug') slug: string,
    @Body() dto: CreateGuestAppointmentDto,
  ) {
    // TODO: Get storeId from slug
    // For now, we'll need to implement slug lookup
    throw new Error('Not implemented - need slug to storeId lookup');
  }
}
