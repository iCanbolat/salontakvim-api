import {
  IsString,
  IsOptional,
  MaxLength,
  IsBoolean,
  IsUUID,
} from 'class-validator';

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
}
