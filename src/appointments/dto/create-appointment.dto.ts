import {
  IsInt,
  IsOptional,
  IsString,
  IsEmail,
  IsDateString,
  IsArray,
  ValidateNested,
  Min,
  IsUUID,
} from 'class-validator';
import { Type } from 'class-transformer';

class AppointmentExtraDto {
  @IsUUID()
  extraId: string;

  @IsInt()
  @Min(1)
  quantity: number;
}

export class CreateAppointmentDto {
  @IsUUID()
  serviceId: string;

  @IsUUID()
  @IsOptional()
  staffId?: string;

  @IsUUID()
  @IsOptional()
  locationId?: string;

  @IsDateString()
  startDateTime: string;

  @IsInt()
  @Min(1)
  @IsOptional()
  numberOfPeople?: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AppointmentExtraDto)
  @IsOptional()
  extras?: AppointmentExtraDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AppointmentExtraDto)
  @IsOptional()
  extrasData?: AppointmentExtraDto[];

  @IsString()
  @IsOptional()
  customerNotes?: string;

  // Guest fields (used by admin/staff to create appointments for non-authenticated customers)
  @IsString()
  @IsOptional()
  guestFirstName?: string;

  @IsString()
  @IsOptional()
  customerName?: string;

  @IsString()
  @IsOptional()
  guestLastName?: string;

  @IsString()
  @IsOptional()
  customerLastName?: string;

  @IsEmail()
  @IsOptional()
  guestEmail?: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  guestPhone?: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsString()
  @IsOptional()
  couponCode?: string;

  @IsString()
  @IsOptional()
  paymentSessionId?: string;
}
