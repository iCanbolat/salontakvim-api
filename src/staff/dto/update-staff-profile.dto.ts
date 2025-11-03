import {
  IsString,
  IsOptional,
  MaxLength,
  IsBoolean,
  IsInt,
} from 'class-validator';

export class UpdateStaffProfileDto {
  @IsString()
  @IsOptional()
  bio?: string;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  title?: string;

  @IsInt()
  @IsOptional()
  locationId?: number;

  @IsBoolean()
  @IsOptional()
  isVisible?: boolean;
}
