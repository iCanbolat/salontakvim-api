import {
  IsString,
  IsOptional,
  MaxLength,
  IsBoolean,
  IsUUID,
  IsEnum,
} from 'class-validator';

export enum StaffRole {
  ADMIN = 'admin',
  MANAGER = 'manager',
  STAFF = 'staff',
}

export class UpdateStaffProfileDto {
  @IsString()
  @IsOptional()
  bio?: string;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  title?: string;

  @IsUUID()
  @IsOptional()
  locationId?: string;

  @IsBoolean()
  @IsOptional()
  isVisible?: boolean;

  @IsEnum(StaffRole)
  @IsOptional()
  role?: StaffRole;
}
