import {
  IsEmail,
  IsNotEmpty,
  MaxLength,
  IsOptional,
  IsUUID,
  IsIn,
} from 'class-validator';

export class InviteStaffDto {
  @IsEmail()
  @IsNotEmpty()
  @MaxLength(255)
  email: string;

  @IsOptional()
  @IsIn(['admin', 'manager', 'staff'])
  role?: 'admin' | 'manager' | 'staff';

  @IsOptional()
  @MaxLength(255)
  title?: string;

  @IsOptional()
  @IsUUID()
  locationId?: string;
}
