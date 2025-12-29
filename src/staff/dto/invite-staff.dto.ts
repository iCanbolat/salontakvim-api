import {
  IsEmail,
  IsNotEmpty,
  MaxLength,
  IsOptional,
  IsUUID,
} from 'class-validator';

export class InviteStaffDto {
  @IsEmail()
  @IsNotEmpty()
  @MaxLength(255)
  email: string;

  @IsOptional()
  @MaxLength(255)
  title?: string;

  @IsOptional()
  @IsUUID()
  locationId?: string;
}
