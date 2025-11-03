import { PartialType } from '@nestjs/mapped-types';
import { CreateStoreDto } from './create-store.dto';
import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateStoreDto extends PartialType(CreateStoreDto) {
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
