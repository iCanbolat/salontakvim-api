import { IsString, IsOptional, MaxLength } from 'class-validator';

export class UpdateFeedbackDto {
  @IsString()
  @IsOptional()
  @MaxLength(2000)
  comment?: string;
}

export class RespondToFeedbackDto {
  @IsString()
  @MaxLength(2000)
  storeResponse: string;
}
