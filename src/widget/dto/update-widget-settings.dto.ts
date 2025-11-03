import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsHexColor,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum WidgetLayout {
  LIST = 'list', // All selections in one step (default - like Amelia)
  STEPS = 'steps', // Separate steps for service, employee, location
}

class SidebarMenuItemsDto {
  @IsBoolean()
  service: boolean;

  @IsBoolean()
  employee: boolean;

  @IsBoolean()
  location: boolean;

  @IsBoolean()
  extras: boolean;

  @IsBoolean()
  dateTime: boolean;

  @IsBoolean()
  customerInfo: boolean;

  @IsBoolean()
  payment: boolean;
}

export class UpdateWidgetSettingsDto {
  // Layout & Structure
  @IsEnum(WidgetLayout)
  @IsOptional()
  layout?: WidgetLayout;

  @IsBoolean()
  @IsOptional()
  showCompanyEmail?: boolean;

  @IsEmail()
  @IsOptional()
  companyEmail?: string;

  // Sidebar Configuration
  @ValidateNested()
  @Type(() => SidebarMenuItemsDto)
  @IsOptional()
  sidebarMenuItems?: SidebarMenuItemsDto;

  // Field Requirements (based on Amelia)
  @IsBoolean()
  @IsOptional()
  employeeRequired?: boolean;

  @IsBoolean()
  @IsOptional()
  locationRequired?: boolean;

  @IsBoolean()
  @IsOptional()
  lastNameRequired?: boolean;

  @IsBoolean()
  @IsOptional()
  emailRequired?: boolean;

  @IsBoolean()
  @IsOptional()
  phoneRequired?: boolean;

  // Colors & Styling (inspired by Amelia)
  @IsHexColor()
  @IsOptional()
  primaryColor?: string;

  @IsHexColor()
  @IsOptional()
  secondaryColor?: string;

  @IsHexColor()
  @IsOptional()
  sidebarBackgroundColor?: string;

  @IsHexColor()
  @IsOptional()
  contentBackgroundColor?: string;

  @IsHexColor()
  @IsOptional()
  textColor?: string;

  @IsHexColor()
  @IsOptional()
  headingColor?: string;

  // Typography
  @IsString()
  @MaxLength(100)
  @IsOptional()
  fontFamily?: string;

  @IsInt()
  @Min(10)
  @Max(20)
  @IsOptional()
  fontSize?: number;

  // Button Styling
  @IsInt()
  @Min(0)
  @Max(50)
  @IsOptional()
  buttonBorderRadius?: number;

  // Other Settings
  @IsBoolean()
  @IsOptional()
  showProgressBar?: boolean;

  @IsBoolean()
  @IsOptional()
  allowGuestBooking?: boolean;

  @IsUrl()
  @IsOptional()
  redirectUrlAfterBooking?: string;
}
