import {
  IsInt,
  IsOptional,
  IsString,
  IsDateString,
  IsArray,
  ValidateNested,
  Min,
  IsPositive,
} from 'class-validator';
import { Type } from 'class-transformer';

class AppointmentExtraDto {
  @IsInt()
  @IsPositive()
  extraId: number;

  @IsInt()
  @Min(1)
  quantity: number;
}

export class CreateAppointmentDto {
  @IsInt()
  @IsPositive()
  serviceId: number;

  @IsInt()
  @IsPositive()
  staffId: number;

  @IsInt()
  @IsPositive()
  @IsOptional()
  locationId?: number;

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

  @IsString()
  @IsOptional()
  customerNotes?: string;
}
