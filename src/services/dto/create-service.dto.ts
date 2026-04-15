import {
  IsString,
  IsOptional,
  MaxLength,
  IsNotEmpty,
  IsBoolean,
  IsInt,
  Min,
  Matches,
  IsNumber,
  IsUUID,
} from 'class-validator';

export class CreateServiceDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name!: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsUUID()
  @IsOptional()
  categoryId?: string;

  @IsInt()
  @Min(1)
  duration!: number; // minutes

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  price!: number;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  creemProductId?: string;

  @IsInt()
  @IsOptional()
  @Min(1)
  capacity?: number;

  @IsInt()
  @IsOptional()
  @Min(0)
  bufferTimeBefore?: number;

  @IsInt()
  @IsOptional()
  @Min(0)
  bufferTimeAfter?: number;

  @IsString()
  @IsOptional()
  image?: string;

  @IsBoolean()
  @IsOptional()
  isVisible?: boolean;

  @IsBoolean()
  @IsOptional()
  showBringingAnyoneOption?: boolean;

  @IsBoolean()
  @IsOptional()
  allowRecurring?: boolean;

  @IsInt()
  @IsOptional()
  @Min(0)
  position?: number;
}
