import {
  IsString,
  IsEmail,
  IsOptional,
  MaxLength,
  MinLength,
  Matches,
  IsNotEmpty,
  IsBoolean,
} from 'class-validator';

export class CreateStoreDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;

  @IsString()
  @MinLength(3)
  @MaxLength(255)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message:
      'Slug must be lowercase alphanumeric with hyphens (e.g., my-store-name)',
  })
  slug: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  logo?: string;

  @IsEmail()
  @IsOptional()
  @MaxLength(255)
  email?: string;

  @IsString()
  @IsOptional()
  @MaxLength(50)
  phone?: string;

  @IsString()
  @IsOptional()
  @MaxLength(2)
  country?: string;

  @IsString()
  @IsOptional()
  @MaxLength(3)
  currency?: string;

  @IsBoolean()
  @IsOptional()
  sendFeedbackViaSms?: boolean;

  // Optional staff profile creation for the owner (onboarding)
  @IsBoolean()
  @IsOptional()
  createStaffProfile?: boolean;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  staffTitle?: string;

  @IsString()
  @IsOptional()
  @MaxLength(1000)
  staffBio?: string;

  @IsBoolean()
  @IsOptional()
  staffIsVisible?: boolean;
}
