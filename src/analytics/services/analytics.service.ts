import { Injectable, NotFoundException } from '@nestjs/common';
import { AnalyticsRepository } from '../repositories/analytics.repository';
import { StoreService } from '../../stores/services/store.service';
import {
  AnalyticsQueryDto,
  DateRangePreset,
  DashboardResponseDto,
  DashboardStatsDto,
  RecentActivityDto,
  AppointmentAnalyticsResponseDto,
  RevenueAnalyticsResponseDto,
  RevenueSummaryDto,
  CustomerAnalyticsResponseDto,
  CustomerRetentionDto,
  StaffAnalyticsResponseDto,
  ServiceAnalyticsResponseDto,
} from '../dto';
import { plainToInstance } from 'class-transformer';

@Injectable()
export class AnalyticsService {
  constructor(
    private readonly analyticsRepository: AnalyticsRepository,
    private readonly storeService: StoreService,
  ) {}

  private parseDateRange(query: AnalyticsQueryDto): {
    startDate: Date;
    endDate: Date;
  } {
    const now = new Date();
    let startDate: Date;
    let endDate: Date = new Date();

    if (query.dateRange && query.dateRange !== DateRangePreset.CUSTOM) {
      switch (query.dateRange) {
        case DateRangePreset.TODAY:
          startDate = new Date(now);
          startDate.setHours(0, 0, 0, 0);
          endDate = new Date(now);
          endDate.setHours(23, 59, 59, 999);
          break;
        case DateRangePreset.YESTERDAY:
          startDate = new Date(now);
          startDate.setDate(startDate.getDate() - 1);
          startDate.setHours(0, 0, 0, 0);
          endDate = new Date(now);
          endDate.setDate(endDate.getDate() - 1);
          endDate.setHours(23, 59, 59, 999);
          break;
        case DateRangePreset.LAST_7_DAYS:
          startDate = new Date(now);
          startDate.setDate(startDate.getDate() - 7);
          startDate.setHours(0, 0, 0, 0);
          endDate = new Date(now);
          endDate.setHours(23, 59, 59, 999);
          break;
        case DateRangePreset.LAST_30_DAYS:
          startDate = new Date(now);
          startDate.setDate(startDate.getDate() - 30);
          startDate.setHours(0, 0, 0, 0);
          endDate = new Date(now);
          endDate.setHours(23, 59, 59, 999);
          break;
        case DateRangePreset.THIS_MONTH:
          startDate = new Date(
            now.getFullYear(),
            now.getMonth(),
            1,
            0,
            0,
            0,
            0,
          );
          endDate = new Date(
            now.getFullYear(),
            now.getMonth() + 1,
            0,
            23,
            59,
            59,
            999,
          );
          break;
        case DateRangePreset.LAST_MONTH:
          startDate = new Date(
            now.getFullYear(),
            now.getMonth() - 1,
            1,
            0,
            0,
            0,
            0,
          );
          endDate = new Date(
            now.getFullYear(),
            now.getMonth(),
            0,
            23,
            59,
            59,
            999,
          );
          break;
        case DateRangePreset.THIS_YEAR:
          startDate = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
          endDate = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
          break;
        default:
          startDate = new Date(now);
          startDate.setDate(startDate.getDate() - 30);
          startDate.setHours(0, 0, 0, 0);
          endDate = new Date(now);
          endDate.setHours(23, 59, 59, 999);
      }
    } else if (query.startDate && query.endDate) {
      startDate = new Date(query.startDate);
      endDate = new Date(query.endDate);
    } else {
      // Default to last 30 days
      startDate = new Date(now);
      startDate.setDate(startDate.getDate() - 30);
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date(now);
      endDate.setHours(23, 59, 59, 999);
    }

    return { startDate, endDate };
  }

  private calculatePercentage(value: number, total: number): string {
    if (total === 0) return '0.00';
    return ((value / total) * 100).toFixed(2);
  }

  async getDashboard(
    storeId: number,
    ownerId: number,
    query: AnalyticsQueryDto,
  ): Promise<DashboardResponseDto> {
    // Verify store ownership
    await this.storeService.verifyStoreOwnership(storeId, ownerId);

    const { startDate, endDate } = this.parseDateRange(query);
    const dateRange = { startDate, endDate };

    // Get all stats in parallel
    const [
      totalAppointments,
      totalRevenue,
      totalCustomers,
      totalStaff,
      appointmentsByStatus,
      popularTimeSlot,
      todayAppointments,
      tomorrowAppointments,
      todayRevenue,
    ] = await Promise.all([
      this.analyticsRepository.getTotalAppointments(storeId), // All time
      this.analyticsRepository.getTotalRevenue(storeId), // All time
      this.analyticsRepository.getTotalCustomers(storeId),
      this.getTotalStaff(storeId),
      this.analyticsRepository.getAppointmentsByStatus(storeId), // All time
      this.analyticsRepository.getPopularTimeSlot(storeId, dateRange),
      this.getAppointmentsForDate(storeId, new Date()),
      this.getAppointmentsForDate(storeId, new Date(Date.now() + 86400000)), // Tomorrow
      this.getRevenueForDate(storeId, new Date()),
    ]);

    // Calculate status counts
    const pending =
      appointmentsByStatus.find((s) => s.status === 'pending')?.count || 0;
    const confirmed =
      appointmentsByStatus.find((s) => s.status === 'confirmed')?.count || 0;
    const completed =
      appointmentsByStatus.find((s) => s.status === 'completed')?.count || 0;
    const cancelled =
      appointmentsByStatus.find((s) => s.status === 'cancelled')?.count || 0;
    const noShow =
      appointmentsByStatus.find((s) => s.status === 'no_show')?.count || 0;
    const expired =
      appointmentsByStatus.find((s) => s.status === 'expired')?.count || 0;

    const cancellationRate = this.calculatePercentage(
      cancelled,
      totalAppointments,
    );
    const averageAppointmentValue =
      totalAppointments > 0
        ? (parseFloat(totalRevenue) / totalAppointments).toFixed(2)
        : '0.00';

    const stats: DashboardStatsDto = {
      totalAppointments,
      totalRevenue,
      totalCustomers,
      totalStaff,
      appointmentsToday: todayAppointments,
      appointmentsTomorrow: tomorrowAppointments,
      revenueToday: todayRevenue,
      pendingAppointments: pending,
      confirmedAppointments: confirmed,
      completedAppointments: completed,
      cancelledAppointments: cancelled,
      noShowAppointments: noShow,
      expiredAppointments: expired,
      cancellationRate,
      averageAppointmentValue,
      popularTimeSlot,
    };

    // Recent activity (simplified - can be expanded)
    const recentActivity: RecentActivityDto[] = [];

    return plainToInstance(
      DashboardResponseDto,
      {
        stats,
        recentActivity,
        calculatedAt: new Date(),
      },
      { excludeExtraneousValues: true },
    );
  }

  async getAppointmentAnalytics(
    storeId: number,
    ownerId: number,
    query: AnalyticsQueryDto,
  ): Promise<AppointmentAnalyticsResponseDto> {
    await this.storeService.verifyStoreOwnership(storeId, ownerId);

    const { startDate, endDate } = this.parseDateRange(query);
    const dateRange = { startDate, endDate };
    const groupBy =
      (query.groupBy === 'year' ? 'month' : query.groupBy) || 'day';

    const [
      totalAppointments,
      totalRevenue,
      byStatus,
      byDate,
      byTimeSlot,
      byService,
      byStaff,
    ] = await Promise.all([
      this.analyticsRepository.getTotalAppointments(storeId, dateRange),
      this.analyticsRepository.getTotalRevenue(storeId, dateRange),
      this.analyticsRepository.getAppointmentsByStatus(storeId, dateRange),
      this.analyticsRepository.getAppointmentsByDate(
        storeId,
        dateRange,
        groupBy as 'day' | 'week' | 'month',
      ),
      this.analyticsRepository.getAppointmentsByTimeSlot(storeId, dateRange),
      this.analyticsRepository.getAppointmentsByService(storeId, dateRange),
      this.analyticsRepository.getAppointmentsByStaff(storeId, dateRange),
    ]);

    const averageAppointmentValue =
      totalAppointments > 0
        ? (parseFloat(totalRevenue) / totalAppointments).toFixed(2)
        : '0.00';

    // Add percentages
    const byStatusWithPercentage = byStatus.map((item) => ({
      ...item,
      percentage: this.calculatePercentage(item.count, totalAppointments),
    }));

    const totalTimeSlotCount = byTimeSlot.reduce(
      (sum, item) => sum + item.count,
      0,
    );
    const byTimeSlotWithPercentage = byTimeSlot.map((item) => ({
      ...item,
      percentage: this.calculatePercentage(item.count, totalTimeSlotCount),
    }));

    const byServiceWithPercentage = byService.map((item) => ({
      ...item,
      percentage: this.calculatePercentage(item.count, totalAppointments),
    }));

    const byStaffWithPercentage = byStaff.map((item) => ({
      ...item,
      percentage: this.calculatePercentage(item.count, totalAppointments),
    }));

    return plainToInstance(
      AppointmentAnalyticsResponseDto,
      {
        totalAppointments,
        totalRevenue,
        averageAppointmentValue,
        byStatus: byStatusWithPercentage,
        byDate,
        byTimeSlot: byTimeSlotWithPercentage,
        byService: byServiceWithPercentage,
        byStaff: byStaffWithPercentage,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        calculatedAt: new Date(),
      },
      { excludeExtraneousValues: true },
    );
  }

  async getRevenueAnalytics(
    storeId: number,
    ownerId: number,
    query: AnalyticsQueryDto,
  ): Promise<RevenueAnalyticsResponseDto> {
    await this.storeService.verifyStoreOwnership(storeId, ownerId);

    const { startDate, endDate } = this.parseDateRange(query);
    const dateRange = { startDate, endDate };
    const groupBy =
      (query.groupBy === 'year' ? 'month' : query.groupBy) || 'day';

    const [
      totalRevenue,
      totalAppointments,
      paidUnpaid,
      byDate,
      byService,
      byStaff,
      byPaymentMethod,
    ] = await Promise.all([
      this.analyticsRepository.getTotalRevenue(storeId, dateRange),
      this.analyticsRepository.getTotalAppointments(storeId, dateRange),
      this.analyticsRepository.getPaidUnpaidCounts(storeId, dateRange),
      this.analyticsRepository.getRevenueByDate(
        storeId,
        dateRange,
        groupBy as 'day' | 'week' | 'month',
      ),
      this.analyticsRepository.getRevenueByService(storeId, dateRange),
      this.analyticsRepository.getRevenueByStaff(storeId, dateRange),
      this.analyticsRepository.getRevenueByPaymentMethod(storeId, dateRange),
    ]);

    const averageAppointmentValue =
      paidUnpaid.paid > 0
        ? (parseFloat(totalRevenue) / paidUnpaid.paid).toFixed(2)
        : '0.00';

    const collectionRate = this.calculatePercentage(
      paidUnpaid.paid,
      paidUnpaid.paid + paidUnpaid.unpaid,
    );

    const totalRevenueNum = parseFloat(totalRevenue);

    const summary: RevenueSummaryDto = {
      totalRevenue,
      averageAppointmentValue,
      totalAppointments,
      paidAppointments: paidUnpaid.paid,
      unpaidAppointments: paidUnpaid.unpaid,
      collectionRate,
    };

    // Add percentages
    const byDateWithAverage = byDate.map((item) => ({
      ...item,
      averageValue:
        item.appointmentCount > 0
          ? (parseFloat(item.revenue) / item.appointmentCount).toFixed(2)
          : '0.00',
    }));

    const byServiceWithPercentage = byService.map((item) => ({
      ...item,
      percentage: this.calculatePercentage(
        parseFloat(item.revenue),
        totalRevenueNum,
      ),
    }));

    const byStaffWithPercentage = byStaff.map((item) => ({
      ...item,
      percentage: this.calculatePercentage(
        parseFloat(item.revenue),
        totalRevenueNum,
      ),
    }));

    const byPaymentMethodWithPercentage = byPaymentMethod.map((item) => ({
      ...item,
      percentage: this.calculatePercentage(
        parseFloat(item.revenue),
        totalRevenueNum,
      ),
    }));

    return plainToInstance(
      RevenueAnalyticsResponseDto,
      {
        summary,
        byDate: byDateWithAverage,
        byService: byServiceWithPercentage,
        byStaff: byStaffWithPercentage,
        byPaymentMethod: byPaymentMethodWithPercentage,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        calculatedAt: new Date(),
      },
      { excludeExtraneousValues: true },
    );
  }

  async getCustomerAnalytics(
    storeId: number,
    ownerId: number,
    query: AnalyticsQueryDto,
  ): Promise<CustomerAnalyticsResponseDto> {
    await this.storeService.verifyStoreOwnership(storeId, ownerId);

    const { startDate, endDate } = this.parseDateRange(query);
    const dateRange = { startDate, endDate };
    const groupBy =
      (query.groupBy === 'year' ? 'month' : query.groupBy) || 'day';

    const [totalCustomers, growth, topCustomers, retention, bySource] =
      await Promise.all([
        this.analyticsRepository.getTotalCustomers(storeId),
        this.analyticsRepository.getCustomerGrowth(
          storeId,
          dateRange,
          groupBy as 'day' | 'week' | 'month',
        ),
        this.analyticsRepository.getTopCustomers(
          storeId,
          dateRange,
          query.limit || 10,
        ),
        this.analyticsRepository.getCustomerRetention(storeId, dateRange),
        this.analyticsRepository.getCustomersBySource(storeId),
      ]);

    const newCustomersInPeriod = growth.reduce(
      (sum, item) => sum + item.newCustomers,
      0,
    );
    const activeCustomers = topCustomers.length;

    const retentionRate = this.calculatePercentage(
      retention.returningCustomers,
      retention.newCustomers + retention.returningCustomers,
    );

    const totalAppointments = topCustomers.reduce(
      (sum, customer) => sum + customer.appointmentCount,
      0,
    );
    const averageAppointmentsPerCustomer = (
      totalAppointments /
      (retention.newCustomers + retention.returningCustomers || 1)
    ).toFixed(2);

    const retentionDto: CustomerRetentionDto = {
      newCustomers: retention.newCustomers,
      returningCustomers: retention.returningCustomers,
      retentionRate,
      averageAppointmentsPerCustomer,
    };

    const topCustomersWithAverage = topCustomers.map((customer) => ({
      ...customer,
      averageSpent: (
        parseFloat(customer.totalSpent) / customer.appointmentCount
      ).toFixed(2),
    }));

    const totalSourceCount = bySource.reduce(
      (sum, item) => sum + item.count,
      0,
    );
    const bySourceWithPercentage = bySource.map((item) => ({
      ...item,
      percentage: this.calculatePercentage(item.count, totalSourceCount),
    }));

    return plainToInstance(
      CustomerAnalyticsResponseDto,
      {
        totalCustomers,
        newCustomersInPeriod,
        activeCustomers,
        retention: retentionDto,
        growth,
        topCustomers: topCustomersWithAverage,
        bySource: bySourceWithPercentage,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        calculatedAt: new Date(),
      },
      { excludeExtraneousValues: true },
    );
  }

  async getStaffAnalytics(
    storeId: number,
    ownerId: number,
    query: AnalyticsQueryDto,
  ): Promise<StaffAnalyticsResponseDto> {
    await this.storeService.verifyStoreOwnership(storeId, ownerId);

    const { startDate, endDate } = this.parseDateRange(query);
    const dateRange = { startDate, endDate };

    const [totalStaff, performance, availability] = await Promise.all([
      this.getTotalStaff(storeId),
      this.analyticsRepository.getStaffPerformance(storeId, dateRange),
      this.analyticsRepository.getStaffAvailability(storeId),
    ]);

    const activeStaff = performance.filter(
      (p) => p.appointmentCount > 0,
    ).length;

    // Add calculated fields to performance
    const performanceWithRates = performance.map((staff) => {
      const completionRate = this.calculatePercentage(
        staff.completedAppointments,
        staff.appointmentCount,
      );
      const averageRevenue =
        staff.appointmentCount > 0
          ? (parseFloat(staff.totalRevenue) / staff.appointmentCount).toFixed(2)
          : '0.00';

      // Find availability data
      const availData = availability.find((a) => a.staffId === staff.staffId);
      const utilizationRate = availData
        ? this.calculatePercentage(availData.bookedHours, availData.totalHours)
        : '0.00';

      return {
        ...staff,
        completionRate,
        averageRevenue,
        utilizationRate,
      };
    });

    // Calculate availability utilization rates
    const availabilityWithRates = availability.map((staff) => {
      const utilizationRate = this.calculatePercentage(
        staff.bookedHours,
        staff.totalHours,
      );
      const availableHours = staff.totalHours - staff.bookedHours;

      return {
        ...staff,
        availableHours,
        utilizationRate,
      };
    });

    // Staff comparison metrics
    const comparison = [
      {
        metric: 'Most Appointments',
        topPerformer:
          performance.length > 0
            ? performance.reduce((max, p) =>
                p.appointmentCount > max.appointmentCount ? p : max,
              ).staffName
            : 'N/A',
        topValue:
          performance.length > 0
            ? performance
                .reduce((max, p) =>
                  p.appointmentCount > max.appointmentCount ? p : max,
                )
                .appointmentCount.toString()
            : '0',
        average: (
          performance.reduce((sum, p) => sum + p.appointmentCount, 0) /
          (performance.length || 1)
        ).toFixed(2),
      },
      {
        metric: 'Highest Revenue',
        topPerformer:
          performance.length > 0
            ? performance.reduce((max, p) =>
                parseFloat(p.totalRevenue) > parseFloat(max.totalRevenue)
                  ? p
                  : max,
              ).staffName
            : 'N/A',
        topValue:
          performance.length > 0
            ? performance
                .reduce((max, p) =>
                  parseFloat(p.totalRevenue) > parseFloat(max.totalRevenue)
                    ? p
                    : max,
                )
                .totalRevenue.toString()
            : '0',
        average: (
          performance.reduce((sum, p) => sum + parseFloat(p.totalRevenue), 0) /
          (performance.length || 1)
        ).toFixed(2),
      },
    ];

    return plainToInstance(
      StaffAnalyticsResponseDto,
      {
        totalStaff,
        activeStaff,
        performance: performanceWithRates,
        availability: availabilityWithRates,
        comparison,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        calculatedAt: new Date(),
      },
      { excludeExtraneousValues: true },
    );
  }

  async getServiceAnalytics(
    storeId: number,
    ownerId: number,
    query: AnalyticsQueryDto,
  ): Promise<ServiceAnalyticsResponseDto> {
    await this.storeService.verifyStoreOwnership(storeId, ownerId);

    const { startDate, endDate } = this.parseDateRange(query);
    const dateRange = { startDate, endDate };
    const groupBy =
      (query.groupBy === 'year' ? 'month' : query.groupBy) || 'day';

    const [
      totalServices,
      popularity,
      byTime,
      byCategory,
      extras,
      totalRevenue,
    ] = await Promise.all([
      this.getTotalServices(storeId),
      this.analyticsRepository.getServicePopularity(
        storeId,
        dateRange,
        query.limit,
      ),
      this.analyticsRepository.getServiceByTime(
        storeId,
        dateRange,
        groupBy as 'day' | 'week' | 'month',
      ),
      this.analyticsRepository.getServiceCategoryPerformance(
        storeId,
        dateRange,
      ),
      this.analyticsRepository.getServiceExtrasAnalytics(storeId, dateRange),
      this.analyticsRepository.getTotalRevenue(storeId, dateRange),
    ]);

    const activeServices = popularity.filter(
      (s) => s.appointmentCount > 0,
    ).length;

    // Add percentages and trends to popularity
    const totalRevenueNum = parseFloat(totalRevenue);
    const popularityWithMetrics = popularity.map((service) => ({
      ...service,
      percentage: this.calculatePercentage(
        parseFloat(service.revenue),
        totalRevenueNum,
      ),
      trend: 'stable' as 'up' | 'down' | 'stable', // Simplified - can be calculated by comparing periods
      trendPercentage: '0.00',
    }));

    // Add percentages to categories
    const byCategoryWithPercentage = byCategory.map((category) => ({
      ...category,
      percentage: this.calculatePercentage(
        parseFloat(category.revenue),
        totalRevenueNum,
      ),
    }));

    // Calculate attach rate for extras
    const extrasWithAttachRate = extras.map((extra) => ({
      ...extra,
      attachRate: this.calculatePercentage(
        extra.timesAdded,
        extra.totalAppointments,
      ),
    }));

    return plainToInstance(
      ServiceAnalyticsResponseDto,
      {
        totalServices,
        activeServices,
        totalRevenue,
        popularity: popularityWithMetrics,
        byTime,
        byCategory: byCategoryWithPercentage,
        extras: extrasWithAttachRate,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        calculatedAt: new Date(),
      },
      { excludeExtraneousValues: true },
    );
  }

  // ==================== HELPER METHODS ====================

  private async getTotalStaff(storeId: number): Promise<number> {
    // This should ideally come from StaffModule, but kept simple for now
    return 0; // Placeholder - integrate with StaffRepository
  }

  private async getTotalServices(storeId: number): Promise<number> {
    // This should ideally come from ServicesModule
    return 0; // Placeholder - integrate with ServiceRepository
  }

  private async getAppointmentsForDate(
    storeId: number,
    date: Date,
  ): Promise<number> {
    const startDate = new Date(date.setHours(0, 0, 0, 0));
    const endDate = new Date(date.setHours(23, 59, 59, 999));
    return this.analyticsRepository.getTotalAppointments(storeId, {
      startDate,
      endDate,
    });
  }

  private async getRevenueForDate(
    storeId: number,
    date: Date,
  ): Promise<string> {
    const startDate = new Date(date.setHours(0, 0, 0, 0));
    const endDate = new Date(date.setHours(23, 59, 59, 999));
    return this.analyticsRepository.getTotalRevenue(storeId, {
      startDate,
      endDate,
    });
  }
}
