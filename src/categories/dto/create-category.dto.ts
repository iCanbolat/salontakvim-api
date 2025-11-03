import {
  IsString,
  IsOptional,
  MaxLength,
  IsNotEmpty,
  IsBoolean,
  IsInt,
  Min,
  Matches,
} from 'class-validator';

export class CreateCategoryDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  @MaxLength(7)
  @Matches(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, {
    message: 'Color must be a valid hex color (e.g., #FF5733)',
  })
  color?: string;

  @IsString()
  @IsOptional()
  @MaxLength(50)
  icon?: string;

  @IsInt()
  @IsOptional()
  @Min(0)
  position?: number;

  @IsBoolean()
  @IsOptional()
  isVisible?: boolean;
}
