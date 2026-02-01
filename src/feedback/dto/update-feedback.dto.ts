import { IsString, IsOptional, MaxLength } from 'class-validator';

export class UpdateFeedbackDto {
  @IsString()
  @IsOptional()
  @MaxLength(2000)
  comment?: string;
}
