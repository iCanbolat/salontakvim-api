import {
  IsEmail,
  IsNotEmpty,
  IsString,
  MinLength,
  IsOptional,
  IsEnum,
  MaxLength,
  Matches,
  IsBoolean,
} from 'class-validator';

export class RegisterDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  firstName: string;

  @IsString()
  @IsNotEmpty()
  lastName: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  storeName: string;

  @IsString()
  @IsOptional()
  @MinLength(3)
  @MaxLength(255)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message:
      'Slug must be lowercase alphanumeric with hyphens (e.g., my-store-name)',
  })
  storeSlug?: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  @IsNotEmpty()
  password: string;

  @IsEnum(['local', 'google', 'facebook', 'apple'])
  @IsOptional()
  authProvider?: 'local' | 'google' | 'facebook' | 'apple';

  @IsString()
  @IsOptional()
  providerId?: string;

  @IsString()
  @IsOptional()
  avatar?: string;

  // Optional staff profile creation for the owner
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

export class LoginDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  password: string;
}

export class RefreshTokenDto {
  @IsString()
  @IsNotEmpty()
  refreshToken: string;
}

export class ForgotPasswordDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;
}

export class ResetPasswordDto {
  @IsString()
  @IsNotEmpty()
  token: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  password: string;
}

export class SocialAuthDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  providerId: string;

  @IsEnum(['google', 'facebook', 'apple'])
  @IsNotEmpty()
  provider: 'google' | 'facebook' | 'apple';

  @IsString()
  @IsNotEmpty()
  firstName: string;

  @IsString()
  @IsOptional()
  lastName?: string;

  @IsString()
  @IsOptional()
  avatar?: string;
}
