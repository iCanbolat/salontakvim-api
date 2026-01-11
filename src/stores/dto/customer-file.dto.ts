import { Expose, Type } from 'class-transformer';
import {
  IsString,
  IsOptional,
  IsArray,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class UploadCustomerFileDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}

export class UpdateCustomerFileDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}

export class CustomerFileResponseDto {
  @Expose()
  id: string;

  @Expose()
  storeId: string;

  @Expose()
  customerId: string;

  @Expose()
  uploadedBy: string | null;

  @Expose()
  fileName: string;

  @Expose()
  originalName: string;

  @Expose()
  mimeType: string;

  @Expose()
  fileType: string;

  @Expose()
  fileSize: number;

  @Expose()
  description: string | null;

  @Expose()
  @Type(() => Array)
  tags: string[] | null;

  @Expose()
  createdAt: Date;

  @Expose()
  updatedAt: Date;

  // URL for downloading the file (generated, not stored)
  @Expose()
  downloadUrl?: string;
}

export class CustomerFileListResponseDto {
  @Expose()
  @Type(() => CustomerFileResponseDto)
  files: CustomerFileResponseDto[];

  @Expose()
  total: number;

  @Expose()
  totalSize: number; // Total size of all files in bytes
}
