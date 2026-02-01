import { Expose, Type } from 'class-transformer';

// Store basic info for widget
class WidgetStoreInfo {
  @Expose()
  id: string;

  @Expose()
  name: string;

  @Expose()
  slug: string;

  @Expose()
  description?: string;

  @Expose()
  logo?: string;

  @Expose()
  email?: string;

  @Expose()
  phone?: string;

  @Expose()
  currency: string;

  @Expose()
  storeImages?: string[];
}

// Widget configuration for public use
export class WidgetConfigResponseDto {
  @Expose()
  widgetKey?: string;

  @Expose()
  @Type(() => WidgetStoreInfo)
  store: WidgetStoreInfo;

  @Expose()
  layout: string;

  @Expose()
  showCompanyEmail: boolean;

  @Expose()
  companyEmail?: string;

  @Expose()
  sidebarMenuItems: {
    service: boolean;
    employee: boolean;
    location: boolean;
    extras: boolean;
    dateTime: boolean;
    customerInfo: boolean;
    payment: boolean;
  };

  @Expose()
  styling: {
    primaryColor: string;
    secondaryColor: string;
    sidebarBackgroundColor: string;
    contentBackgroundColor: string;
    textColor: string;
    headingColor: string;
    fontFamily: string;
    fontSize: number;
    buttonBorderRadius: number;
  };

  @Expose()
  settings: {
    showProgressBar: boolean;
    allowGuestBooking: boolean;
    redirectUrlAfterBooking?: string;
  };

  constructor(partial: Partial<WidgetConfigResponseDto>) {
    Object.assign(this, partial);
  }
}
