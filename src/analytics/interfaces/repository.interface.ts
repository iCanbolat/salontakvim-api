export interface DateRange {
  startDate: Date;
  endDate: Date;
}

export interface AppointmentStatusCount {
  status: string;
  count: number;
}

export interface AppointmentByDate {
  date: string;
  count: number;
  revenue: string;
}

export interface AppointmentByTimeSlot {
  timeSlot: string;
  count: number;
}

export interface AppointmentByService {
  serviceId: string;
  serviceName: string;
  count: number;
  revenue: string;
}

export interface AppointmentByStaff {
  staffId: string;
  staffName: string;
  count: number;
  revenue: string;
}

export interface RevenueByDate {
  date: string;
  revenue: string;
  appointmentCount: number;
}

export interface RevenueByService {
  serviceId: string;
  serviceName: string;
  revenue: string;
  appointmentCount: number;
}

export interface RevenueByStaff {
  staffId: string;
  staffName: string;
  revenue: string;
  appointmentCount: number;
}

export interface RevenueByPaymentMethod {
  paymentMethod: string;
  revenue: string;
  appointmentCount: number;
}

export interface CustomerGrowth {
  date: string;
  newCustomers: number;
  totalCustomers: number;
}

export interface TopCustomer {
  customerId: string;
  customerName: string;
  customerEmail: string;
  appointmentCount: number;
  totalSpent: string;
  lastAppointmentDate: Date;
}

export interface CustomerBySource {
  source: string;
  count: number;
}

export interface StaffPerformance {
  staffId: string;
  staffName: string;
  appointmentCount: number;
  completedAppointments: number;
  cancelledAppointments: number;
  noShowAppointments: number;
  totalRevenue: string;
  rating?: string;
}

export interface StaffAvailability {
  staffId: string;
  staffName: string;
  totalHours: number;
  bookedHours: number;
}

export interface ServicePopularity {
  serviceId: string;
  serviceName: string;
  categoryName: string;
  appointmentCount: number;
  revenue: string;
  averagePrice: string;
}

export interface ServiceByTime {
  date: string;
  serviceId: string;
  serviceName: string;
  count: number;
  revenue: string;
}

export interface ServiceCategoryPerformance {
  categoryId: string;
  categoryName: string;
  serviceCount: number;
  appointmentCount: number;
  revenue: string;
}

export interface ServiceExtrasAnalytics {
  extraId: string;
  extraName: string;
  serviceName: string;
  timesAdded: number;
  revenue: string;
  totalAppointments: number;
}
