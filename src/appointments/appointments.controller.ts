import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  ParseIntPipe,
  UseGuards,
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
} from './dto';

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
export class AppointmentsController {
  constructor(private readonly appointmentsService: AppointmentsService) {}

  // ============= Customer Endpoints =============

  @Post('stores/:storeId/appointments')
  @Roles('customer', 'admin', 'staff')
  async createAppointment(
    @Param('storeId', ParseIntPipe) storeId: number,
    @Body() dto: CreateAppointmentDto,
    @CurrentUser() user: JwtPayload,
  ) {
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
  @Roles('customer', 'admin', 'staff')
  async getMyAppointment(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: JwtPayload,
  ) {
    // Note: Service should validate user owns this appointment
    const appointment = await this.appointmentsService.getAppointmentById(
      id,
      0, // Will need to get storeId from appointment
    );
    return appointment;
  }

  @Patch('appointments/:id')
  @Roles('customer')
  async updateMyAppointment(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateAppointmentDto,
    @CurrentUser() user: JwtPayload,
  ) {
    // Note: Service should validate user owns this appointment
    const appointment = await this.appointmentsService.getAppointmentById(
      id,
      0,
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
    @Param('id', ParseIntPipe) id: number,
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
  @Roles('admin', 'staff')
  async getStoreAppointments(@Param('storeId', ParseIntPipe) storeId: number) {
    return await this.appointmentsService.getStoreAppointments(storeId);
  }

  @Get('stores/:storeId/appointments/:id')
  @Roles('admin', 'staff')
  async getStoreAppointment(
    @Param('storeId', ParseIntPipe) storeId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return await this.appointmentsService.getAppointmentById(id, storeId);
  }

  @Patch('stores/:storeId/appointments/:id')
  @Roles('admin', 'staff')
  async updateStoreAppointment(
    @Param('storeId', ParseIntPipe) storeId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateAppointmentDto,
  ) {
    return await this.appointmentsService.updateAppointment(id, storeId, dto);
  }

  @Patch('stores/:storeId/appointments/:id/status')
  @Roles('admin', 'staff')
  async updateAppointmentStatus(
    @Param('storeId', ParseIntPipe) storeId: number,
    @Param('id', ParseIntPipe) id: number,
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
    @Param('storeId', ParseIntPipe) storeId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    await this.appointmentsService.deleteAppointment(id, storeId);
    return { message: 'Appointment deleted successfully' };
  }

  // ============= Availability Endpoints =============

  @Get('stores/:storeId/availability')
  @Public()
  async getAvailability(
    @Param('storeId', ParseIntPipe) storeId: number,
    @Query('serviceId', ParseIntPipe) serviceId: number,
    @Query('staffId', ParseIntPipe) staffId: number,
    @Query('date') date: string,
    @Query('locationId') locationId?: string,
  ) {
    const locationIdNum = locationId ? parseInt(locationId) : undefined;
    return await this.appointmentsService.getAvailability(
      serviceId,
      staffId,
      date,
      locationIdNum,
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
