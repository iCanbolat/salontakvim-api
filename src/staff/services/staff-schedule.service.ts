import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { ActivitiesService } from '../../activities/services/activities.service';
import { StaffMemberRepository } from '../repositories/staff-member.repository';
import { StaffWorkingHoursRepository } from '../repositories/staff-working-hours.repository';
import { StaffBreakRepository } from '../repositories/staff-break.repository';
import { CreateWorkingHoursDto } from '../dto/create-working-hours.dto';
import { UpdateWorkingHoursDto } from '../dto/update-working-hours.dto';
import { CreateStaffBreakDto } from '../dto/create-staff-break.dto';
import { UpdateStaffBreakDto } from '../dto/update-staff-break.dto';

@Injectable()
export class StaffScheduleService {
  constructor(
    private readonly staffMemberRepository: StaffMemberRepository,
    private readonly staffWorkingHoursRepository: StaffWorkingHoursRepository,
    private readonly staffBreakRepository: StaffBreakRepository,
    private readonly activitiesService: ActivitiesService,
  ) {}

  async getStaffByUserId(userId: number) {
    return await this.staffMemberRepository.findByUserId(userId);
  }

  private async getStaffMember(storeId: number, staffId: number) {
    const staff = await this.staffMemberRepository.findByIdAndStoreId(
      staffId,
      storeId,
    );

    if (!staff) {
      throw new NotFoundException('Staff member not found');
    }

    return staff;
  }

  // ============= Working Hours =============

  async createWorkingHours(
    storeId: number,
    staffId: number,
    dto: CreateWorkingHoursDto,
  ) {
    const staff = await this.getStaffMember(storeId, staffId);

    return await this.staffWorkingHoursRepository.create({
      staffId: staff.id,
      ...dto,
    });
  }

  async getWorkingHours(storeId: number, staffId: number) {
    const staff = await this.getStaffMember(storeId, staffId);
    return await this.staffWorkingHoursRepository.findByStaffId(staff.id);
  }

  async updateWorkingHours(
    storeId: number,
    staffId: number,
    workingHoursId: number,
    dto: UpdateWorkingHoursDto,
  ) {
    const staff = await this.getStaffMember(storeId, staffId);

    const workingHours =
      await this.staffWorkingHoursRepository.findByIdAndStaffId(
        workingHoursId,
        staff.id,
      );

    if (!workingHours) {
      throw new NotFoundException('Working hours not found');
    }

    return await this.staffWorkingHoursRepository.update(workingHoursId, dto);
  }

  async deleteWorkingHours(
    storeId: number,
    staffId: number,
    workingHoursId: number,
  ) {
    const staff = await this.getStaffMember(storeId, staffId);

    const workingHours =
      await this.staffWorkingHoursRepository.findByIdAndStaffId(
        workingHoursId,
        staff.id,
      );

    if (!workingHours) {
      throw new NotFoundException('Working hours not found');
    }

    await this.staffWorkingHoursRepository.delete(workingHoursId);
  }

  // ============= Breaks & Time Off =============

  async createStaffBreak(
    storeId: number,
    staffId: number,
    dto: CreateStaffBreakDto,
  ) {
    const staff = await this.getStaffMember(storeId, staffId);

    // Validate date range
    if (dto.endDate < dto.startDate) {
      throw new BadRequestException('End date must be after start date');
    }

    // Check for overlapping breaks
    const overlappingBreaks =
      await this.staffBreakRepository.findByStaffIdAndDateRange(
        staff.id,
        dto.startDate,
        dto.endDate,
      );

    // Filter out declined requests
    const activeOverlaps = overlappingBreaks.filter(
      (b) => b.status !== 'declined',
    );

    if (activeOverlaps.length > 0) {
      throw new ConflictException(
        'This break overlaps with an existing break or time off',
      );
    }

    const createdBreak = await this.staffBreakRepository.create({
      staffId: staff.id,
      ...dto,
    });

    await this.activitiesService.recordActivity(
      storeId,
      'staff',
      'Personel zaman izni eklendi',
      {
        staffId: staff.id,
        breakId: createdBreak.id,
        startDate: dto.startDate,
        endDate: dto.endDate,
        startTime: dto.startTime,
        endTime: dto.endTime,
      },
    );

    return createdBreak;
  }

  async getStaffBreaks(storeId: number, staffId: number) {
    const staff = await this.getStaffMember(storeId, staffId);
    return await this.staffBreakRepository.findByStaffId(staff.id);
  }

  async getStaffBreak(storeId: number, staffId: number, breakId: number) {
    const staff = await this.getStaffMember(storeId, staffId);
    const staffBreak = await this.staffBreakRepository.findByIdAndStaffId(
      breakId,
      staff.id,
    );
    if (!staffBreak) {
      throw new NotFoundException('Break not found');
    }
    return staffBreak;
  }

  async updateStaffBreak(
    storeId: number,
    staffId: number,
    breakId: number,
    dto: UpdateStaffBreakDto,
  ) {
    const staff = await this.getStaffMember(storeId, staffId);

    const staffBreak = await this.staffBreakRepository.findByIdAndStaffId(
      breakId,
      staff.id,
    );

    if (!staffBreak) {
      throw new NotFoundException('Break not found');
    }

    // If dates are being updated, check for overlaps
    if (dto.startDate || dto.endDate) {
      const startDate = dto.startDate || staffBreak.startDate;
      const endDate = dto.endDate || staffBreak.endDate;

      if (endDate < startDate) {
        throw new BadRequestException('End date must be after start date');
      }

      const overlappingBreaks =
        await this.staffBreakRepository.findByStaffIdAndDateRange(
          staff.id,
          startDate,
          endDate,
        );

      // Filter out the current break and declined breaks
      const conflicts = overlappingBreaks.filter(
        (b) => b.id !== breakId && b.status !== 'declined',
      );
      if (conflicts.length > 0) {
        throw new ConflictException(
          'This break overlaps with an existing break or time off',
        );
      }
    }

    return await this.staffBreakRepository.update(breakId, dto);
  }

  async deleteStaffBreak(storeId: number, staffId: number, breakId: number) {
    const staff = await this.getStaffMember(storeId, staffId);

    const staffBreak = await this.staffBreakRepository.findByIdAndStaffId(
      breakId,
      staff.id,
    );

    if (!staffBreak) {
      throw new NotFoundException('Break not found');
    }

    await this.staffBreakRepository.delete(breakId);
  }
}
