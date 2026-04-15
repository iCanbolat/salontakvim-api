import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Param,
  Body,
  ParseUUIDPipe,
  ParseEnumPipe,
  UseGuards,
  Query,
  ForbiddenException,
  UseInterceptors,
  UploadedFile,
  HttpCode,
  HttpStatus,
  Res,
  StreamableFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { createReadStream } from 'fs';
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
import { BulkUpsertWorkingHoursDto } from './dto/bulk-upsert-working-hours.dto';
import {
  CreateStaffBreakDto,
  StaffBreakStatus,
} from './dto/create-staff-break.dto';
import { UpdateStaffBreakDto } from './dto/update-staff-break.dto';
import { AssignServicesDto } from './dto/assign-services.dto';
import { Public } from '../auth/decorators/public.decorator';
import { AcceptInvitationDto } from './dto/accept-invitation.dto';
import { AvatarFileInterceptor } from '../common/file-upload';

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
export class StaffController {
  constructor(
    private readonly staffService: StaffService,
    private readonly staffInvitationService: StaffInvitationService,
    private readonly staffScheduleService: StaffScheduleService,
  ) {}

  private async assertManagerLocationAccess(
    storeId: string,
    staffId: string,
    user: JwtPayload,
    actionLabel: string,
  ) {
    if (user.role !== 'manager' || !user.locationId) {
      return;
    }

    const staff = await this.staffService.getStaffMember(storeId, staffId);
    if (staff.locationId !== user.locationId) {
      throw new ForbiddenException(
        `You can only ${actionLabel} for staff in your location`,
      );
    }
  }

  // ============= Staff Invitations =============

  @Post('stores/:storeId/staff/invite')
  @Roles('admin', 'manager')
  async inviteStaff(
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Body() dto: InviteStaffDto,
    @CurrentUser() user: JwtPayload,
  ) {
    // For manager role, force invitation to their location and staff role only
    const inviteDto =
      user.role === 'manager' && user.locationId
        ? { ...dto, locationId: user.locationId, role: 'staff' as const }
        : { ...dto, role: dto.role ?? 'staff' };

    return await this.staffInvitationService.inviteStaff(
      storeId,
      inviteDto,
      user.sub,
    );
  }

  @Get('stores/:storeId/staff/invitations')
  @Roles('admin', 'manager')
  async getInvitations(
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    // For manager role, filter invitations by their location
    const locationId = user.role === 'manager' ? user.locationId : undefined;
    return await this.staffInvitationService.getInvitations(
      storeId,
      locationId,
    );
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
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Param('invitationId', ParseUUIDPipe) invitationId: string,
  ) {
    await this.staffInvitationService.deleteInvitation(storeId, invitationId);
    return { message: 'Invitation deleted successfully' };
  }

  // ============= Staff Management =============

  @Get('stores/:storeId/staff')
  @Roles('admin', 'manager', 'staff')
  async getStaffMembers(
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @CurrentUser() user: JwtPayload,
    @Query('includeHidden') includeHidden?: string,
    @Query('serviceId') serviceId?: string,
    @Query('locationId') locationId?: string,
    @Query('search') search?: string,
  ) {
    const includeHiddenBool = includeHidden === 'true';

    // For manager role, force filter by their assigned location
    const effectiveLocationId =
      user.role === 'manager' ? user.locationId : locationId;

    return await this.staffService.getStaffMembers(storeId, includeHiddenBool, {
      serviceId: serviceId,
      locationId: effectiveLocationId,
      search,
    });
  }

  @Get('stores/:storeId/staff/:staffId')
  @Roles('admin', 'manager', 'staff')
  async getStaffMember(
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Param('staffId', ParseUUIDPipe) staffId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    const locationId = user.role === 'manager' ? user.locationId : undefined;
    const details = await this.staffService.getStaffDetails(
      storeId,
      staffId,
      locationId,
    );

    // For manager role, verify staff belongs to their location
    if (user.role === 'manager' && user.locationId) {
      if (details.staff.locationId !== user.locationId) {
        throw new ForbiddenException(
          'You can only view staff members from your location',
        );
      }
    }

    return details;
  }

  @Patch('stores/:storeId/staff/:staffId')
  @Roles('admin', 'manager')
  async updateStaffProfile(
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Param('staffId', ParseUUIDPipe) staffId: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateStaffProfileDto,
  ) {
    // For manager role, verify staff belongs to their location
    if (user.role === 'manager' && user.locationId) {
      const staff = await this.staffService.getStaffMember(storeId, staffId);
      if (staff.locationId !== user.locationId) {
        throw new ForbiddenException(
          'You can only update staff members from your location',
        );
      }
      // Manager cannot change role to admin or change locationId
      if (dto.role === 'admin') {
        throw new ForbiddenException('Managers cannot grant admin access');
      }
      if (dto.locationId && dto.locationId !== user.locationId) {
        throw new ForbiddenException(
          'Managers cannot move staff to another location',
        );
      }
    }
    return await this.staffService.updateStaffProfile(storeId, staffId, dto);
  }

  @Post('stores/:storeId/staff/:staffId/avatar')
  @Roles('admin', 'manager', 'staff')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FileInterceptor('file'), AvatarFileInterceptor)
  async uploadStaffAvatar(
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Param('staffId', ParseUUIDPipe) staffId: string,
    @CurrentUser() user: JwtPayload,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (user.role === 'staff') {
      const staff = await this.staffService.getStaffMember(storeId, staffId);
      if (!staff || staff.userId !== user.sub) {
        throw new ForbiddenException(
          'You can only update your own profile avatar',
        );
      }
    }

    return await this.staffService.uploadStaffAvatar(storeId, staffId, file);
  }

  @Get('stores/:storeId/avatars/:fileName')
  @Public()
  async getStaffAvatar(
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Param('fileName') fileName: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const fileInfo = await this.staffService.getAvatarFile(storeId, fileName);

    res.set({
      'Content-Type': fileInfo.mimeType,
      'Cache-Control': 'public, max-age=31536000, immutable',
    });

    return new StreamableFile(createReadStream(fileInfo.path));
  }

  @Post('stores/:storeId/staff/self')
  @Roles('admin')
  async createSelfStaffProfile(
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Body() dto: UpdateStaffProfileDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return await this.staffService.createSelfStaffProfile(
      storeId,
      user.sub,
      dto,
    );
  }

  @Delete('stores/:storeId/staff/:staffId')
  @Roles('admin')
  async deleteStaffMember(
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Param('staffId', ParseUUIDPipe) staffId: string,
  ) {
    await this.staffService.deleteStaffMember(storeId, staffId);
    return { message: 'Staff member deleted successfully' };
  }

  // ============= Service Assignments =============

  @Post('stores/:storeId/staff/:staffId/services')
  @Roles('admin', 'manager')
  async assignServices(
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Param('staffId', ParseUUIDPipe) staffId: string,
    @Body() dto: AssignServicesDto,
    @CurrentUser() user: JwtPayload,
  ) {
    if (user.role === 'manager' && user.locationId) {
      const staff = await this.staffService.getStaffMember(storeId, staffId);
      if (staff.locationId !== user.locationId) {
        throw new ForbiddenException(
          'You can only manage services for staff in your location',
        );
      }
    }
    return await this.staffService.assignServices(storeId, staffId, dto);
  }

  @Get('stores/:storeId/staff/:staffId/services')
  @Roles('admin', 'manager', 'staff')
  async getStaffServices(
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Param('staffId', ParseUUIDPipe) staffId: string,
  ) {
    return await this.staffService.getStaffServices(storeId, staffId);
  }

  @Delete('stores/:storeId/staff/:staffId/services/:serviceId')
  @Roles('admin', 'manager')
  async removeServiceFromStaff(
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Param('staffId', ParseUUIDPipe) staffId: string,
    @Param('serviceId', ParseUUIDPipe) serviceId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    if (user.role === 'manager' && user.locationId) {
      const staff = await this.staffService.getStaffMember(storeId, staffId);
      if (staff.locationId !== user.locationId) {
        throw new ForbiddenException(
          'You can only manage services for staff in your location',
        );
      }
    }
    await this.staffService.removeServiceFromStaff(storeId, staffId, serviceId);
    return { message: 'Service removed from staff successfully' };
  }

  // ============= Working Hours =============

  @Post('stores/:storeId/staff/:staffId/working-hours')
  @Roles('admin', 'manager')
  async createWorkingHours(
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Param('staffId', ParseUUIDPipe) staffId: string,
    @Body() dto: CreateWorkingHoursDto,
    @CurrentUser() user: JwtPayload,
  ) {
    await this.assertManagerLocationAccess(
      storeId,
      staffId,
      user,
      'create working hours',
    );
    return await this.staffScheduleService.createWorkingHours(
      storeId,
      staffId,
      dto,
    );
  }

  @Get('stores/:storeId/staff/:staffId/working-hours')
  @Roles('admin', 'manager', 'staff')
  async getWorkingHours(
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Param('staffId', ParseUUIDPipe) staffId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    await this.assertManagerLocationAccess(
      storeId,
      staffId,
      user,
      'view working hours',
    );
    return await this.staffScheduleService.getWorkingHours(storeId, staffId);
  }

  @Put('stores/:storeId/staff/:staffId/working-hours/bulk')
  @Roles('admin', 'manager')
  async bulkUpsertWorkingHours(
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Param('staffId', ParseUUIDPipe) staffId: string,
    @Body() dto: BulkUpsertWorkingHoursDto,
    @CurrentUser() user: JwtPayload,
  ) {
    await this.assertManagerLocationAccess(
      storeId,
      staffId,
      user,
      'bulk update working hours',
    );
    return await this.staffScheduleService.bulkUpsertWorkingHours(
      storeId,
      staffId,
      dto,
    );
  }

  @Patch('stores/:storeId/staff/:staffId/working-hours/:workingHoursId')
  @Roles('admin', 'manager')
  async updateWorkingHours(
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Param('staffId', ParseUUIDPipe) staffId: string,
    @Param('workingHoursId', ParseUUIDPipe) workingHoursId: string,
    @Body() dto: UpdateWorkingHoursDto,
    @CurrentUser() user: JwtPayload,
  ) {
    await this.assertManagerLocationAccess(
      storeId,
      staffId,
      user,
      'update working hours',
    );
    return await this.staffScheduleService.updateWorkingHours(
      storeId,
      staffId,
      workingHoursId,
      dto,
    );
  }

  @Delete('stores/:storeId/staff/:staffId/working-hours/:workingHoursId')
  @Roles('admin', 'manager')
  async deleteWorkingHours(
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Param('staffId', ParseUUIDPipe) staffId: string,
    @Param('workingHoursId', ParseUUIDPipe) workingHoursId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    await this.assertManagerLocationAccess(
      storeId,
      staffId,
      user,
      'delete working hours',
    );
    await this.staffScheduleService.deleteWorkingHours(
      storeId,
      staffId,
      workingHoursId,
    );
    return { message: 'Working hours deleted successfully' };
  }

  // ============= Breaks & Time Off =============

  @Get('stores/:storeId/breaks')
  @Roles('admin', 'manager')
  async getStoreBreaks(
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Query('status', new ParseEnumPipe(StaffBreakStatus, { optional: true }))
    status?: StaffBreakStatus,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @CurrentUser() user?: JwtPayload,
  ) {
    const locationId = user?.role === 'manager' ? user.locationId : undefined;
    const pageNumber = page ? Number(page) : undefined;
    const limitNumber = limit ? Number(limit) : undefined;

    return await this.staffScheduleService.getStoreBreaks(
      storeId,
      status,
      locationId,
      {
        page: Number.isFinite(pageNumber) ? pageNumber : undefined,
        limit: Number.isFinite(limitNumber) ? limitNumber : undefined,
      },
    );
  }

  @Post('stores/:storeId/staff/:staffId/breaks')
  @Roles('admin', 'manager', 'staff')
  async createStaffBreak(
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Param('staffId', ParseUUIDPipe) staffId: string,
    @Body() dto: CreateStaffBreakDto,
    @CurrentUser() user: JwtPayload,
  ) {
    await this.assertManagerLocationAccess(
      storeId,
      staffId,
      user,
      'create breaks',
    );
    if (user.role === 'staff') {
      const staff = await this.staffScheduleService.getStaffByUserId(user.sub);
      if (!staff || staff.id !== staffId) {
        throw new ForbiddenException('You can only create breaks for yourself');
      }
      dto.status = StaffBreakStatus.PENDING;
    } else {
      dto.status = dto.status ?? StaffBreakStatus.APPROVED;
    }
    return await this.staffScheduleService.createStaffBreak(
      storeId,
      staffId,
      dto,
    );
  }

  @Get('stores/:storeId/staff/:staffId/breaks')
  @Roles('admin', 'manager', 'staff')
  async getStaffBreaks(
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Param('staffId', ParseUUIDPipe) staffId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    await this.assertManagerLocationAccess(
      storeId,
      staffId,
      user,
      'view breaks',
    );
    return await this.staffScheduleService.getStaffBreaks(storeId, staffId);
  }

  @Patch('stores/:storeId/staff/:staffId/breaks/:breakId')
  @Roles('admin', 'manager')
  async updateStaffBreak(
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Param('staffId', ParseUUIDPipe) staffId: string,
    @Param('breakId', ParseUUIDPipe) breakId: string,
    @Body() dto: UpdateStaffBreakDto,
    @CurrentUser() user: JwtPayload,
  ) {
    await this.assertManagerLocationAccess(
      storeId,
      staffId,
      user,
      'update breaks',
    );
    return await this.staffScheduleService.updateStaffBreak(
      storeId,
      staffId,
      breakId,
      dto,
    );
  }

  @Delete('stores/:storeId/staff/:staffId/breaks/:breakId')
  @Roles('admin', 'manager', 'staff')
  async deleteStaffBreak(
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Param('staffId', ParseUUIDPipe) staffId: string,
    @Param('breakId', ParseUUIDPipe) breakId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    await this.assertManagerLocationAccess(
      storeId,
      staffId,
      user,
      'delete breaks',
    );
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
