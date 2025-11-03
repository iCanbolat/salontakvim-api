import {
  IsString,
  IsOptional,
  MaxLength,
  IsNotEmpty,
  IsBoolean,
  IsEmail,
  IsDecimal,
} from 'class-validator';

export class CreateLocationDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;

  @IsString()
  @IsOptional()
  address?: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  city?: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  state?: string;

  @IsString()
  @IsOptional()
  @MaxLength(20)
  zipCode?: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  country?: string;

  @IsString()
  @IsOptional()
  @MaxLength(50)
  phone?: string;

  @IsEmail()
  @IsOptional()
  @MaxLength(255)
  email?: string;

  @IsOptional()
  @IsDecimal()
  latitude?: string;

  @IsOptional()
  @IsDecimal()
  longitude?: string;

  @IsBoolean()
  @IsOptional()
  isVisible?: boolean;
}
