import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateConnectStatusDto {
  @IsBoolean()
  onboardingComplete!: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  accountId?: string;
}
