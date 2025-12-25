import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  ParseIntPipe,
  ParseEnumPipe,
  UseGuards,
  Query,
  ForbiddenException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import type { JwtPayload } from '../auth/interfaces/auth.interface';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { StaffService } from './services/staff.service';
import { StaffScheduleService } from './services/staff-schedule.service';
import { StaffInvitationService } from './services/staff-invitation.service';
import { InviteStaffDto } from './dto/invite-staff.dto';
import { UpdateStaffProfileDto } from './dto/update-staff-profile.dto';
import { CreateWorkingHoursDto } from './dto/create-working-hours.dto';
import { UpdateWorkingHoursDto } from './dto/update-working-hours.dto';
import {
  CreateStaffBreakDto,
  StaffBreakStatus,
} from './dto/create-staff-break.dto';
import { UpdateStaffBreakDto } from './dto/update-staff-break.dto';
import { AssignServicesDto } from './dto/assign-services.dto';
import { Public } from '../auth/decorators/public.decorator';
import { AcceptInvitationDto } from './dto/accept-invitation.dto';

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
export class StaffController {
  constructor(
    private readonly staffService: StaffService,
    private readonly staffInvitationService: StaffInvitationService,
    private readonly staffScheduleService: StaffScheduleService,
  ) {}

  // ============= Staff Invitations =============

  @Post('stores/:storeId/staff/invite')
  @Roles('admin')
  async inviteStaff(
    @Param('storeId', ParseIntPipe) storeId: number,
    @Body() dto: InviteStaffDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return await this.staffInvitationService.inviteStaff(
      storeId,
      dto,
      user.sub,
    );
  }

  @Get('stores/:storeId/staff/invitations')
  @Roles('admin')
  async getInvitations(@Param('storeId', ParseIntPipe) storeId: number) {
    return await this.staffInvitationService.getInvitations(storeId);
  }

  @Get('staff/invitations/:token')
  @Public()
  async getInvitationByToken(@Param('token') token: string) {
    return await this.staffInvitationService.getInvitationByToken(token);
  }

  @Post('staff/invitations/:token/accept')
  @Public()
  async acceptInvitation(
    @Param('token') token: string,
    @Body() dto: AcceptInvitationDto,
  ) {
    return await this.staffInvitationService.acceptInvitation(token, dto);
  }

  @Delete('stores/:storeId/staff/invitations/:invitationId')
  @Roles('admin')
  async deleteInvitation(
    @Param('storeId', ParseIntPipe) storeId: number,
    @Param('invitationId', ParseIntPipe) invitationId: number,
  ) {
    await this.staffInvitationService.deleteInvitation(storeId, invitationId);
    return { message: 'Invitation deleted successfully' };
  }

  // ============= Staff Management =============

  @Get('stores/:storeId/staff')
  @Roles('admin', 'staff')
  async getStaffMembers(
    @Param('storeId', ParseIntPipe) storeId: number,
    @Query('includeHidden') includeHidden?: string,
    @Query('serviceId') serviceId?: string,
    @Query('locationId') locationId?: string,
  ) {
    const includeHiddenBool = includeHidden === 'true';
    const serviceIdNum = serviceId ? parseInt(serviceId) : undefined;
    const locationIdNum = locationId ? parseInt(locationId) : undefined;

    return await this.staffService.getStaffMembers(storeId, includeHiddenBool, {
      serviceId: serviceIdNum,
      locationId: locationIdNum,
    });
  }

  @Get('stores/:storeId/staff/:staffId')
  @Roles('admin', 'staff')
  async getStaffMember(
    @Param('storeId', ParseIntPipe) storeId: number,
    @Param('staffId', ParseIntPipe) staffId: number,
  ) {
    return await this.staffService.getStaffMember(storeId, staffId);
  }

  @Patch('stores/:storeId/staff/:staffId')
  @Roles('admin')
  async updateStaffProfile(
    @Param('storeId', ParseIntPipe) storeId: number,
    @Param('staffId', ParseIntPipe) staffId: number,
    @Body() dto: UpdateStaffProfileDto,
  ) {
    return await this.staffService.updateStaffProfile(storeId, staffId, dto);
  }

  @Delete('stores/:storeId/staff/:staffId')
  @Roles('admin')
  async deleteStaffMember(
    @Param('storeId', ParseIntPipe) storeId: number,
    @Param('staffId', ParseIntPipe) staffId: number,
  ) {
    await this.staffService.deleteStaffMember(storeId, staffId);
    return { message: 'Staff member deleted successfully' };
  }

  // ============= Service Assignments =============

  @Post('stores/:storeId/staff/:staffId/services')
  @Roles('admin')
  async assignServices(
    @Param('storeId', ParseIntPipe) storeId: number,
    @Param('staffId', ParseIntPipe) staffId: number,
    @Body() dto: AssignServicesDto,
  ) {
    return await this.staffService.assignServices(storeId, staffId, dto);
  }

  @Get('stores/:storeId/staff/:staffId/services')
  @Roles('admin', 'staff')
  async getStaffServices(
    @Param('storeId', ParseIntPipe) storeId: number,
    @Param('staffId', ParseIntPipe) staffId: number,
  ) {
    return await this.staffService.getStaffServices(storeId, staffId);
  }

  @Delete('stores/:storeId/staff/:staffId/services/:serviceId')
  @Roles('admin')
  async removeServiceFromStaff(
    @Param('storeId', ParseIntPipe) storeId: number,
    @Param('staffId', ParseIntPipe) staffId: number,
    @Param('serviceId', ParseIntPipe) serviceId: number,
  ) {
    await this.staffService.removeServiceFromStaff(storeId, staffId, serviceId);
    return { message: 'Service removed from staff successfully' };
  }

  // ============= Working Hours =============

  @Post('stores/:storeId/staff/:staffId/working-hours')
  @Roles('admin')
  async createWorkingHours(
    @Param('storeId', ParseIntPipe) storeId: number,
    @Param('staffId', ParseIntPipe) staffId: number,
    @Body() dto: CreateWorkingHoursDto,
  ) {
    return await this.staffScheduleService.createWorkingHours(
      storeId,
      staffId,
      dto,
    );
  }

  @Get('stores/:storeId/staff/:staffId/working-hours')
  @Roles('admin', 'staff')
  async getWorkingHours(
    @Param('storeId', ParseIntPipe) storeId: number,
    @Param('staffId', ParseIntPipe) staffId: number,
  ) {
    return await this.staffScheduleService.getWorkingHours(storeId, staffId);
  }

  @Patch('stores/:storeId/staff/:staffId/working-hours/:workingHoursId')
  @Roles('admin')
  async updateWorkingHours(
    @Param('storeId', ParseIntPipe) storeId: number,
    @Param('staffId', ParseIntPipe) staffId: number,
    @Param('workingHoursId', ParseIntPipe) workingHoursId: number,
    @Body() dto: UpdateWorkingHoursDto,
  ) {
    return await this.staffScheduleService.updateWorkingHours(
      storeId,
      staffId,
      workingHoursId,
      dto,
    );
  }

  @Delete('stores/:storeId/staff/:staffId/working-hours/:workingHoursId')
  @Roles('admin')
  async deleteWorkingHours(
    @Param('storeId', ParseIntPipe) storeId: number,
    @Param('staffId', ParseIntPipe) staffId: number,
    @Param('workingHoursId', ParseIntPipe) workingHoursId: number,
  ) {
    await this.staffScheduleService.deleteWorkingHours(
      storeId,
      staffId,
      workingHoursId,
    );
    return { message: 'Working hours deleted successfully' };
  }

  // ============= Breaks & Time Off =============

  @Get('stores/:storeId/breaks')
  @Roles('admin')
  async getStoreBreaks(
    @Param('storeId', ParseIntPipe) storeId: number,
    @Query('status', new ParseEnumPipe(StaffBreakStatus, { optional: true }))
    status?: StaffBreakStatus,
  ) {
    return await this.staffScheduleService.getStoreBreaks(storeId, status);
  }

  @Post('stores/:storeId/staff/:staffId/breaks')
  @Roles('admin', 'staff')
  async createStaffBreak(
    @Param('storeId', ParseIntPipe) storeId: number,
    @Param('staffId', ParseIntPipe) staffId: number,
    @Body() dto: CreateStaffBreakDto,
    @CurrentUser() user: JwtPayload,
  ) {
    if (user.role === 'staff') {
      const staff = await this.staffScheduleService.getStaffByUserId(user.sub);
      if (!staff || staff.id !== staffId) {
        throw new ForbiddenException('You can only create breaks for yourself');
      }
      dto.status = StaffBreakStatus.PENDING;
    }
    return await this.staffScheduleService.createStaffBreak(
      storeId,
      staffId,
      dto,
    );
  }

  @Get('stores/:storeId/staff/:staffId/breaks')
  @Roles('admin', 'staff')
  async getStaffBreaks(
    @Param('storeId', ParseIntPipe) storeId: number,
    @Param('staffId', ParseIntPipe) staffId: number,
  ) {
    return await this.staffScheduleService.getStaffBreaks(storeId, staffId);
  }

  @Patch('stores/:storeId/staff/:staffId/breaks/:breakId')
  @Roles('admin')
  async updateStaffBreak(
    @Param('storeId', ParseIntPipe) storeId: number,
    @Param('staffId', ParseIntPipe) staffId: number,
    @Param('breakId', ParseIntPipe) breakId: number,
    @Body() dto: UpdateStaffBreakDto,
  ) {
    return await this.staffScheduleService.updateStaffBreak(
      storeId,
      staffId,
      breakId,
      dto,
    );
  }

  @Delete('stores/:storeId/staff/:staffId/breaks/:breakId')
  @Roles('admin', 'staff')
  async deleteStaffBreak(
    @Param('storeId', ParseIntPipe) storeId: number,
    @Param('staffId', ParseIntPipe) staffId: number,
    @Param('breakId', ParseIntPipe) breakId: number,
    @CurrentUser() user: JwtPayload,
  ) {
    if (user.role === 'staff') {
      const staff = await this.staffScheduleService.getStaffByUserId(user.sub);
      if (!staff || staff.id !== staffId) {
        throw new ForbiddenException('You can only delete your own breaks');
      }
      const staffBreak = await this.staffScheduleService.getStaffBreak(
        storeId,
        staffId,
        breakId,
      );
      if (staffBreak.status !== 'pending') {
        throw new ForbiddenException(
          'You can only delete pending requests. Contact admin to cancel approved leave.',
        );
      }
    }
    await this.staffScheduleService.deleteStaffBreak(storeId, staffId, breakId);
    return { message: 'Break deleted successfully' };
  }
}
