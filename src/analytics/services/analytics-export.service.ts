import { Injectable } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { AnalyticsService } from './analytics.service';
import { AnalyticsQueryDto } from '../dto';

@Injectable()
export class AnalyticsExportService {
  constructor(private readonly analyticsService: AnalyticsService) {}

  async exportToExcel(
    storeId: number,
    ownerId: number,
    query: AnalyticsQueryDto,
  ): Promise<Buffer> {
    // Fetch all analytics data
    const [appointmentData, revenueData] = await Promise.all([
      this.analyticsService.getAppointmentAnalytics(storeId, ownerId, query),
      this.analyticsService.getRevenueAnalytics(storeId, ownerId, query),
    ]);

    // Create workbook
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'SalonTakvim';
    workbook.created = new Date();

    // ===== Summary Sheet =====
    const summarySheet = workbook.addWorksheet('Summary');
    this.styleSummarySheet(summarySheet, appointmentData, revenueData);

    // ===== Appointments by Date Sheet =====
    const dateSheet = workbook.addWorksheet('Appointments by Date');
    this.styleAppointmentsByDateSheet(dateSheet, appointmentData.byDate);

    // ===== Appointments by Status Sheet =====
    const statusSheet = workbook.addWorksheet('Appointments by Status');
    this.styleAppointmentsByStatusSheet(statusSheet, appointmentData.byStatus);

    // ===== Revenue by Service Sheet =====
    const serviceSheet = workbook.addWorksheet('Revenue by Service');
    this.styleRevenueByServiceSheet(serviceSheet, revenueData.byService);

    // ===== Revenue by Staff Sheet =====
    const staffSheet = workbook.addWorksheet('Revenue by Staff');
    this.styleRevenueByStaffSheet(staffSheet, revenueData.byStaff);

    // ===== Appointments by Time Slot Sheet =====
    const timeSlotSheet = workbook.addWorksheet('Appointments by Time Slot');
    this.styleAppointmentsByTimeSlotSheet(
      timeSlotSheet,
      appointmentData.byTimeSlot,
    );

    // Generate buffer
    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  private styleSummarySheet(
    sheet: ExcelJS.Worksheet,
    appointmentData: any,
    revenueData: any,
  ) {
    // Title
    sheet.mergeCells('A1:D1');
    const titleCell = sheet.getCell('A1');
    titleCell.value = 'Analytics Summary Report';
    titleCell.font = { bold: true, size: 18, color: { argb: 'FF1F2937' } };
    titleCell.alignment = { horizontal: 'center' };

    // Generated date
    sheet.mergeCells('A2:D2');
    const dateCell = sheet.getCell('A2');
    dateCell.value = `Generated on: ${new Date().toLocaleDateString('en-US', { dateStyle: 'full' })}`;
    dateCell.font = { italic: true, size: 10, color: { argb: 'FF6B7280' } };
    dateCell.alignment = { horizontal: 'center' };

    // Appointment Stats Section
    sheet.getCell('A4').value = 'Appointment Statistics';
    sheet.getCell('A4').font = { bold: true, size: 14 };
    sheet.mergeCells('A4:B4');

    const appointmentStats = [
      ['Total Appointments', appointmentData.totalAppointments],
      ['Total Revenue', `$${appointmentData.totalRevenue}`],
      [
        'Average Appointment Value',
        `$${appointmentData.averageAppointmentValue}`,
      ],
    ];

    let rowIndex = 5;
    appointmentStats.forEach(([label, value]) => {
      sheet.getCell(`A${rowIndex}`).value = label;
      sheet.getCell(`B${rowIndex}`).value = value;
      sheet.getCell(`A${rowIndex}`).font = { color: { argb: 'FF4B5563' } };
      sheet.getCell(`B${rowIndex}`).font = { bold: true };
      rowIndex++;
    });

    // Revenue Stats Section
    rowIndex += 1;
    sheet.getCell(`A${rowIndex}`).value = 'Revenue Statistics';
    sheet.getCell(`A${rowIndex}`).font = { bold: true, size: 14 };
    sheet.mergeCells(`A${rowIndex}:B${rowIndex}`);
    rowIndex++;

    const revenueStats = [
      ['Total Revenue', `$${revenueData.summary.totalRevenue}`],
      ['Paid Appointments', revenueData.summary.paidAppointments],
      ['Unpaid Appointments', revenueData.summary.unpaidAppointments],
      ['Collection Rate', revenueData.summary.collectionRate],
    ];

    revenueStats.forEach(([label, value]) => {
      sheet.getCell(`A${rowIndex}`).value = label;
      sheet.getCell(`B${rowIndex}`).value = value;
      sheet.getCell(`A${rowIndex}`).font = { color: { argb: 'FF4B5563' } };
      sheet.getCell(`B${rowIndex}`).font = { bold: true };
      rowIndex++;
    });

    // Set column widths
    sheet.getColumn('A').width = 30;
    sheet.getColumn('B').width = 20;
  }

  private styleAppointmentsByDateSheet(sheet: ExcelJS.Worksheet, data: any[]) {
    // Header
    const headerRow = sheet.addRow(['Date', 'Appointments', 'Revenue']);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.eachCell((cell) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF3B82F6' },
      };
      cell.alignment = { horizontal: 'center' };
    });

    // Data rows
    data.forEach((item) => {
      const row = sheet.addRow([
        new Date(item.date).toLocaleDateString('en-US'),
        item.count,
        `$${item.revenue}`,
      ]);
      row.getCell(2).alignment = { horizontal: 'center' };
      row.getCell(3).alignment = { horizontal: 'right' };
    });

    // Set column widths
    sheet.getColumn(1).width = 15;
    sheet.getColumn(2).width = 15;
    sheet.getColumn(3).width = 15;

    // Add borders
    this.addTableBorders(sheet, data.length + 1);
  }

  private styleAppointmentsByStatusSheet(
    sheet: ExcelJS.Worksheet,
    data: any[],
  ) {
    // Header
    const headerRow = sheet.addRow(['Status', 'Count', 'Percentage']);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.eachCell((cell) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF10B981' },
      };
      cell.alignment = { horizontal: 'center' };
    });

    // Data rows
    data.forEach((item) => {
      const row = sheet.addRow([
        this.formatStatus(item.status),
        item.count,
        `${item.percentage}%`,
      ]);
      row.getCell(2).alignment = { horizontal: 'center' };
      row.getCell(3).alignment = { horizontal: 'center' };
    });

    // Set column widths
    sheet.getColumn(1).width = 15;
    sheet.getColumn(2).width = 10;
    sheet.getColumn(3).width = 12;

    this.addTableBorders(sheet, data.length + 1);
  }

  private styleRevenueByServiceSheet(sheet: ExcelJS.Worksheet, data: any[]) {
    // Header
    const headerRow = sheet.addRow([
      'Service',
      'Revenue',
      'Appointments',
      'Percentage',
    ]);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.eachCell((cell) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF59E0B' },
      };
      cell.alignment = { horizontal: 'center' };
    });

    // Data rows
    data.forEach((item) => {
      const row = sheet.addRow([
        item.serviceName,
        `$${item.revenue}`,
        item.appointmentCount,
        `${item.percentage}%`,
      ]);
      row.getCell(2).alignment = { horizontal: 'right' };
      row.getCell(3).alignment = { horizontal: 'center' };
      row.getCell(4).alignment = { horizontal: 'center' };
    });

    // Set column widths
    sheet.getColumn(1).width = 30;
    sheet.getColumn(2).width = 15;
    sheet.getColumn(3).width = 15;
    sheet.getColumn(4).width = 12;

    this.addTableBorders(sheet, data.length + 1);
  }

  private styleRevenueByStaffSheet(sheet: ExcelJS.Worksheet, data: any[]) {
    // Header
    const headerRow = sheet.addRow([
      'Staff Member',
      'Revenue',
      'Appointments',
      'Percentage',
    ]);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.eachCell((cell) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF8B5CF6' },
      };
      cell.alignment = { horizontal: 'center' };
    });

    // Data rows
    data.forEach((item) => {
      const row = sheet.addRow([
        item.staffName,
        `$${item.revenue}`,
        item.appointmentCount,
        `${item.percentage}%`,
      ]);
      row.getCell(2).alignment = { horizontal: 'right' };
      row.getCell(3).alignment = { horizontal: 'center' };
      row.getCell(4).alignment = { horizontal: 'center' };
    });

    // Set column widths
    sheet.getColumn(1).width = 25;
    sheet.getColumn(2).width = 15;
    sheet.getColumn(3).width = 15;
    sheet.getColumn(4).width = 12;

    this.addTableBorders(sheet, data.length + 1);
  }

  private styleAppointmentsByTimeSlotSheet(
    sheet: ExcelJS.Worksheet,
    data: any[],
  ) {
    // Header
    const headerRow = sheet.addRow(['Time Slot', 'Appointments', 'Percentage']);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.eachCell((cell) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFEF4444' },
      };
      cell.alignment = { horizontal: 'center' };
    });

    // Data rows
    data.forEach((item) => {
      const row = sheet.addRow([
        item.timeSlot,
        item.count,
        `${item.percentage}%`,
      ]);
      row.getCell(2).alignment = { horizontal: 'center' };
      row.getCell(3).alignment = { horizontal: 'center' };
    });

    // Set column widths
    sheet.getColumn(1).width = 15;
    sheet.getColumn(2).width = 15;
    sheet.getColumn(3).width = 12;

    this.addTableBorders(sheet, data.length + 1);
  }

  private addTableBorders(sheet: ExcelJS.Worksheet, rowCount: number) {
    for (let i = 1; i <= rowCount; i++) {
      const row = sheet.getRow(i);
      row.eachCell((cell) => {
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFD1D5DB' } },
          left: { style: 'thin', color: { argb: 'FFD1D5DB' } },
          bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } },
          right: { style: 'thin', color: { argb: 'FFD1D5DB' } },
        };
      });
    }
  }

  private formatStatus(status: string): string {
    return status
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }
}
