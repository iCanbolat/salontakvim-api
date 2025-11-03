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
  serviceId: number;
  serviceName: string;
  count: number;
  revenue: string;
}

export interface AppointmentByStaff {
  staffId: number;
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
  serviceId: number;
  serviceName: string;
  revenue: string;
  appointmentCount: number;
}

export interface RevenueByStaff {
  staffId: number;
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
  customerId: number;
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
  staffId: number;
  staffName: string;
  appointmentCount: number;
  completedAppointments: number;
  cancelledAppointments: number;
  noShowAppointments: number;
  totalRevenue: string;
  rating?: string;
}

export interface StaffAvailability {
  staffId: number;
  staffName: string;
  totalHours: number;
  bookedHours: number;
}

export interface ServicePopularity {
  serviceId: number;
  serviceName: string;
  categoryName: string;
  appointmentCount: number;
  revenue: string;
  averagePrice: string;
}

export interface ServiceByTime {
  date: string;
  serviceId: number;
  serviceName: string;
  count: number;
  revenue: string;
}

export interface ServiceCategoryPerformance {
  categoryId: number;
  categoryName: string;
  serviceCount: number;
  appointmentCount: number;
  revenue: string;
}

export interface ServiceExtrasAnalytics {
  extraId: number;
  extraName: string;
  serviceName: string;
  timesAdded: number;
  revenue: string;
  totalAppointments: number;
}
