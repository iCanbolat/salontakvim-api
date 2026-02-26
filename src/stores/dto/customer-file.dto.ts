import { Expose, Transform, Type } from 'class-transformer';
import {
  IsString,
  IsOptional,
  IsArray,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class UploadCustomerFileDto {
  @IsOptional()
  @IsUUID()
  appointmentId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined || value === null) return undefined;
    if (Array.isArray(value)) {
      return value
        .filter((v) => typeof v === 'string')
        .map((v) => v.trim())
        .filter(Boolean);
    }
    if (typeof value === 'string') {
      const trimmed = value.trim();
      return trimmed ? [trimmed] : undefined;
    }
    return undefined;
  })
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
  @Transform(({ value }) => {
    if (value === undefined || value === null) return undefined;
    if (Array.isArray(value)) {
      return value
        .filter((v) => typeof v === 'string')
        .map((v) => v.trim())
        .filter(Boolean);
    }
    if (typeof value === 'string') {
      const trimmed = value.trim();
      return trimmed ? [trimmed] : undefined;
    }
    return undefined;
  })
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
  appointmentId: string | null;

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
  // URL for downloading the file (generated, not stored)
  downloadUrl?: string;
}

export class CustomerFileListResponseDto {
  @Expose()
  @Type(() => CustomerFileResponseDto)
  data: CustomerFileResponseDto[];

  @Expose()
  total: number;

  @Expose()
  page: number;

  @Expose()
  limit: number;

  @Expose()
  totalPages: number;

  @Expose()
  totalSize: number; // Total size of all files in bytes
}

export class FolderStatsDto {
  @Expose()
  customerId: string;

  @Expose()
  fileCount: number;

  @Expose()
  totalSize: number;

  @Expose()
  lastUploadedAt: Date;
}

export class FolderListResponseDto {
  @Expose()
  @Type(() => FolderStatsDto)
  data: FolderStatsDto[];

  @Expose()
  total: number;

  @Expose()
  page: number;

  @Expose()
  limit: number;

  @Expose()
  totalPages: number;
}

export class CustomerFilePreviewAppointmentDto {
  @Expose()
  id: string;

  @Expose()
  startDateTime: Date;

  @Expose()
  serviceName: string | null;

  @Expose()
  staffName: string | null;
}

export class CustomerFilePreviewContextDto {
  @Expose()
  @Type(() => CustomerFilePreviewAppointmentDto)
  appointment: CustomerFilePreviewAppointmentDto | null;
}

export class CustomerFileCustomerSummaryDto {
  @Expose()
  id: string;

  @Expose()
  firstName: string | null;

  @Expose()
  lastName: string | null;

  @Expose()
  email: string | null;

  @Expose()
  fullName: string;
}
