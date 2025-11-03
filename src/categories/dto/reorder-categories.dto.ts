import { IsArray, ArrayNotEmpty, IsInt } from 'class-validator';

export class ReorderCategoriesDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsInt({ each: true })
  categoryIds: number[];
}
