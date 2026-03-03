import { Injectable } from '@nestjs/common';
import { AppointmentRepository } from '../repositories/appointment.repository';
import { StaffWorkingHoursRepository } from '../../staff/repositories/staff-working-hours.repository';
import { StaffBreakRepository } from '../../staff/repositories/staff-break.repository';
import { TimeSlotDto } from '../dto/availability-response.dto';

type DayOfWeek =
  | 'monday'
  | 'tuesday'
  | 'wednesday'
  | 'thursday'
  | 'friday'
  | 'saturday'
  | 'sunday';

interface TimeRange {
  start: Date;
  end: Date;
}

@Injectable()
export class AvailabilityService {
  constructor(
    private readonly appointmentRepository: AppointmentRepository,
    private readonly staffWorkingHoursRepository: StaffWorkingHoursRepository,
    private readonly staffBreakRepository: StaffBreakRepository,
  ) {}

  async getAvailableSlots(
    staffId: string,
    serviceId: string,
    date: string, // YYYY-MM-DD
    serviceDuration: number, // in minutes
    bufferBefore: number = 0,
    bufferAfter: number = 0,
    excludeAppointmentId?: string,
  ): Promise<TimeSlotDto[]> {
    const targetDate = new Date(date);
    const dayOfWeek = this.getDayOfWeek(targetDate) as DayOfWeek;

    // 1. Get staff working hours for this day
    const workingHours = await this.getWorkingHoursForDay(staffId, dayOfWeek);
    if (workingHours.length === 0) {
      return []; // Staff doesn't work on this day
    }

    // 2. Get staff breaks for this date
    const breaks = await this.getBreaksForDate(staffId, date);

    // 3. Get existing appointments for this staff on this date
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const existingAppointmentsRaw =
      await this.appointmentRepository.findByStaffIdAndDateRange(
        staffId,
        startOfDay,
        endOfDay,
      );

    const existingAppointments = excludeAppointmentId
      ? existingAppointmentsRaw.filter(
          (appointment) => appointment.id !== excludeAppointmentId,
        )
      : existingAppointmentsRaw;

    // 4. Generate all possible time slots
    const allSlots: TimeSlotDto[] = [];
    const slotInterval = 15; // 15-minute intervals
    const totalDuration = serviceDuration + bufferBefore + bufferAfter;
    const roundedDuration =
      Math.ceil(totalDuration / slotInterval) * slotInterval;

    for (const workingHour of workingHours) {
      if (!workingHour.isActive) continue;

      const workStart = this.parseTime(date, workingHour.startTime);
      const workEnd = this.parseTime(date, workingHour.endTime);

      let currentTime = new Date(workStart);

      while (currentTime < workEnd) {
        const slotStart = new Date(currentTime);
        const slotEnd = new Date(
          currentTime.getTime() + roundedDuration * 60 * 1000,
        );

        // Check if slot fits within working hours
        if (slotEnd > workEnd) {
          break;
        }

        // Check availability
        const availability = this.checkSlotAvailability(
          { start: slotStart, end: slotEnd },
          existingAppointments,
          breaks,
          bufferBefore,
          bufferAfter,
        );

        allSlots.push({
          startTime: this.formatTime(slotStart),
          endTime: this.formatTime(
            new Date(slotStart.getTime() + serviceDuration * 60 * 1000),
          ),
          available: availability.available,
          reason: availability.reason,
        });

        // Move to next slot
        currentTime = new Date(
          currentTime.getTime() + slotInterval * 60 * 1000,
        );
      }
    }

    return allSlots;
  }

  private async getWorkingHoursForDay(staffId: string, dayOfWeek: DayOfWeek) {
    return await this.staffWorkingHoursRepository.findActiveByStaffIdAndDay(
      staffId,
      dayOfWeek,
    );
  }

  private async getBreaksForDate(staffId: string, date: string) {
    // Get breaks that overlap with the target date
    return await this.staffBreakRepository.findByStaffIdAndDateRange(
      staffId,
      date,
      date,
    );
  }

  private checkSlotAvailability(
    slot: TimeRange,
    existingAppointments: any[],
    breaks: any[],
    bufferBefore: number,
    bufferAfter: number,
  ): { available: boolean; reason?: string } {
    // Check if slot overlaps with any existing appointment
    for (const appointment of existingAppointments) {
      const appointmentStart = new Date(appointment.startDateTime);
      const appointmentEnd = new Date(appointment.endDateTime);

      if (
        this.timeRangesOverlap(slot, {
          start: appointmentStart,
          end: appointmentEnd,
        })
      ) {
        return { available: false, reason: 'Already booked' };
      }
    }

    // Check if slot overlaps with any break
    for (const breakPeriod of breaks) {
      const breakStart = this.parseDateTime(
        breakPeriod.startDate,
        breakPeriod.startTime || '00:00',
      );
      const breakEnd = this.parseDateTime(
        breakPeriod.endDate,
        breakPeriod.endTime || '23:59',
      );

      if (this.timeRangesOverlap(slot, { start: breakStart, end: breakEnd })) {
        return { available: false, reason: 'Staff on break' };
      }
    }

    return { available: true };
  }

  private timeRangesOverlap(range1: TimeRange, range2: TimeRange): boolean {
    return range1.start < range2.end && range1.end > range2.start;
  }

  private getDayOfWeek(date: Date): string {
    const days = [
      'sunday',
      'monday',
      'tuesday',
      'wednesday',
      'thursday',
      'friday',
      'saturday',
    ];
    return days[date.getDay()];
  }

  private parseTime(dateStr: string, timeStr: string): Date {
    const [hours, minutes] = timeStr.split(':').map(Number);
    const date = new Date(dateStr);
    date.setHours(hours, minutes, 0, 0);
    return date;
  }

  private parseDateTime(dateStr: string, timeStr: string): Date {
    const [hours, minutes] = timeStr.split(':').map(Number);
    const date = new Date(dateStr);
    date.setHours(hours, minutes, 0, 0);
    return date;
  }

  private formatTime(date: Date): string {
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  }
}
