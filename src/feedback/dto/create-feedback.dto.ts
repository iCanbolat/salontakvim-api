import {
  IsString,
  IsOptional,
  IsInt,
  IsBoolean,
  IsUUID,
  Min,
  Max,
  MaxLength,
} from 'class-validator';

export class CreateFeedbackDto {
  @IsUUID()
  appointmentId: string;

  @IsInt()
  @Min(1)
  @Max(5)
  overallRating: number;

  @IsInt()
  @IsOptional()
  @Min(1)
  @Max(5)
  serviceRating?: number;

  @IsInt()
  @IsOptional()
  @Min(1)
  @Max(5)
  staffRating?: number;

  @IsInt()
  @IsOptional()
  @Min(1)
  @Max(5)
  cleanlinessRating?: number;

  @IsInt()
  @IsOptional()
  @Min(1)
  @Max(5)
  valueRating?: number;

  @IsString()
  @IsOptional()
  @MaxLength(2000)
  comment?: string;

  @IsBoolean()
  @IsOptional()
  isPublic?: boolean;
}
