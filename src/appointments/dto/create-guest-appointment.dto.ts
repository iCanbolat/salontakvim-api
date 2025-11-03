import {
  IsEmail,
  IsString,
  IsNotEmpty,
  MinLength,
  MaxLength,
  IsOptional,
} from 'class-validator';
import { CreateAppointmentDto } from './create-appointment.dto';

export class CreateGuestAppointmentDto extends CreateAppointmentDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(255)
  guestFirstName: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(255)
  guestLastName: string;

  @IsEmail()
  @IsNotEmpty()
  guestEmail: string;

  @IsString()
  @IsOptional()
  @MaxLength(50)
  guestPhone?: string;
}
