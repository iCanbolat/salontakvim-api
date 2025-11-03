import {
  IsString,
  IsOptional,
  MaxLength,
  IsNotEmpty,
  IsInt,
  Min,
  IsNumber,
} from 'class-validator';

export class CreateServiceExtraDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  price: number;

  @IsInt()
  @IsOptional()
  @Min(0)
  duration?: number;

  @IsInt()
  @IsOptional()
  @Min(1)
  maxQuantity?: number;

  @IsInt()
  @IsOptional()
  @Min(0)
  position?: number;
}
