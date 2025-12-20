import {
  IsEmail,
  IsNotEmpty,
  MaxLength,
  IsOptional,
  IsInt,
  Min,
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
  @IsInt()
  @Min(1)
  locationId?: number;
}
