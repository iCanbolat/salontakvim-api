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

  // Customer fields (used by admin/staff/public widget to create appointments for customers)
  @IsString()
  @IsOptional()
  customerFirstName?: string;

  @IsString()
  @IsOptional()
  customerLastName?: string;

  @IsEmail()
  @IsOptional()
  customerEmail?: string;

  @IsString()
  @IsOptional()
  customerPhone?: string;

  @IsString()
  @IsOptional()
  couponCode?: string;

  @IsString()
  @IsOptional()
  paymentSessionId?: string;
}
