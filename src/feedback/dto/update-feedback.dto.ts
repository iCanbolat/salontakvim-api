import { IsString, IsOptional, IsBoolean, MaxLength } from 'class-validator';

export class UpdateFeedbackDto {
  @IsString()
  @IsOptional()
  @MaxLength(2000)
  comment?: string;

  @IsBoolean()
  @IsOptional()
  isPublic?: boolean;
}

export class RespondToFeedbackDto {
  @IsString()
  @MaxLength(2000)
  storeResponse: string;
}
