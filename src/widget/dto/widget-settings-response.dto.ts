import { Expose, Type } from 'class-transformer';

class SidebarMenuItemsResponse {
  @Expose()
  service: boolean;

  @Expose()
  employee: boolean;

  @Expose()
  location: boolean;

  @Expose()
  extras: boolean;

  @Expose()
  dateTime: boolean;

  @Expose()
  customerInfo: boolean;

  @Expose()
  payment: boolean;
}

export class WidgetSettingsResponseDto {
  @Expose()
  id: number;

  @Expose()
  storeId: number;

  @Expose()
  layout: string;

  @Expose()
  showCompanyEmail: boolean;

  @Expose()
  companyEmail?: string;

  @Expose()
  @Type(() => SidebarMenuItemsResponse)
  sidebarMenuItems: SidebarMenuItemsResponse;

  @Expose()
  employeeRequired: boolean;

  @Expose()
  locationRequired: boolean;

  @Expose()
  lastNameRequired: boolean;

  @Expose()
  emailRequired: boolean;

  @Expose()
  phoneRequired: boolean;

  @Expose()
  primaryColor: string;

  @Expose()
  secondaryColor: string;

  @Expose()
  sidebarBackgroundColor: string;

  @Expose()
  contentBackgroundColor: string;

  @Expose()
  textColor: string;

  @Expose()
  headingColor: string;

  @Expose()
  fontFamily: string;

  @Expose()
  fontSize: number;

  @Expose()
  buttonBorderRadius: number;

  @Expose()
  showProgressBar: boolean;

  @Expose()
  allowGuestBooking: boolean;

  @Expose()
  redirectUrlAfterBooking?: string;

  @Expose()
  widgetKey: string;

  @Expose()
  createdAt: Date;

  @Expose()
  updatedAt: Date;

  constructor(partial: Partial<WidgetSettingsResponseDto>) {
    Object.assign(this, partial);
  }
}
