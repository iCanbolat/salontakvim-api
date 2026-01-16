import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { StoreService } from './store.service';
import {
  CustomerFileRepository,
  CreateCustomerFileData,
} from '../repositories/customer-file.repository';
import { StaffMemberRepository } from '../../staff/repositories/staff-member.repository';
import {
  CustomerFileResponseDto,
  CustomerFileListResponseDto,
  UpdateCustomerFileDto,
} from '../dto';
import { plainToInstance } from 'class-transformer';
import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';

// File type detection based on mime type
function getFileType(mimeType: string): 'image' | 'pdf' | 'document' | 'other' {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType === 'application/pdf') return 'pdf';
  if (
    mimeType.includes('word') ||
    mimeType.includes('document') ||
    mimeType.includes('text/') ||
    mimeType.includes('spreadsheet') ||
    mimeType.includes('excel')
  ) {
    return 'document';
  }
  return 'other';
}

// Allowed MIME types for uploads
const ALLOWED_MIME_TYPES = [
  // Images
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  // PDFs
  'application/pdf',
  // Documents
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
  'text/csv',
];

// Max file size: 10MB
const MAX_FILE_SIZE = 10 * 1024 * 1024;

@Injectable()
export class CustomerFileService {
  private readonly uploadDir: string;
  private readonly baseUrl: string;

  constructor(
    private readonly customerFileRepository: CustomerFileRepository,
    private readonly staffMemberRepository: StaffMemberRepository,
    private readonly storeService: StoreService,
    private readonly configService: ConfigService,
  ) {
    // Setup upload directory
    this.uploadDir =
      this.configService.get<string>('UPLOAD_DIR') || './uploads';
    this.baseUrl =
      this.configService.get<string>('APP_URL') || 'http://localhost:8080';

    // Ensure upload directory exists
    this.ensureUploadDir();
  }

  private ensureUploadDir() {
    const customerFilesDir = path.join(this.uploadDir, 'customer-files');
    if (!fs.existsSync(customerFilesDir)) {
      fs.mkdirSync(customerFilesDir, { recursive: true });
    }
  }

  private getStoragePath(storeId: string, customerId: string): string {
    const dir = path.join(
      this.uploadDir,
      'customer-files',
      storeId,
      customerId,
    );
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    return dir;
  }

  async uploadFile(
    storeId: string,
    customerId: string,
    userId: string,
    file: Express.Multer.File,
    metadata?: { description?: string; tags?: string[] },
  ): Promise<CustomerFileResponseDto> {
    // Verify store ownership/access
    await this.storeService.verifyStoreOwnership(storeId, userId);

    // Validate file
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      throw new BadRequestException(
        `File type not allowed. Allowed types: images, PDFs, and common documents`,
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      throw new BadRequestException(
        `File size exceeds maximum allowed size of ${MAX_FILE_SIZE / 1024 / 1024}MB`,
      );
    }

    // Generate unique filename
    const fileExt = path.extname(file.originalname);
    const fileName = `${randomUUID()}${fileExt}`;
    const storagePath = path.join(
      this.getStoragePath(storeId, customerId),
      fileName,
    );

    // Save file to disk
    try {
      fs.writeFileSync(storagePath, file.buffer);
    } catch {
      throw new BadRequestException('Failed to save file');
    }

    // Create database record
    const createData: CreateCustomerFileData = {
      storeId,
      customerId,
      uploadedBy: userId,
      fileName,
      originalName: file.originalname,
      mimeType: file.mimetype,
      fileType: getFileType(file.mimetype),
      fileSize: file.size,
      storagePath,
      storageProvider: 'local',
      description: metadata?.description,
      tags: metadata?.tags,
    };

    const customerFile = await this.customerFileRepository.create(createData);

    return this.toResponseDto(customerFile);
  }

  /**
   * Get all files for a store
   * Admin gets all files, staff only gets files from their assigned customers
   */
  async getAllStoreFiles(
    storeId: string,
    userId: string,
    userRole: string,
    options?: {
      fileType?: string;
      search?: string;
      limit?: number;
      offset?: number;
    },
  ): Promise<CustomerFileListResponseDto> {
    // Verify store ownership/access
    await this.storeService.verifyStoreOwnership(storeId, userId);

    let staffId: string | undefined;

    // If user is staff, filter to only their customers' files
    if (userRole === 'staff') {
      const staffMember =
        await this.staffMemberRepository.findByUserIdAndStoreId(
          userId,
          storeId,
        );
      if (!staffMember) {
        throw new ForbiddenException('Staff member not found');
      }
      staffId = staffMember.id;
    }

    const { files, total, totalSize } =
      await this.customerFileRepository.findByStore(storeId, {
        ...options,
        staffId,
      });

    return plainToInstance(
      CustomerFileListResponseDto,
      {
        files: files.map((f) => this.toResponseDto(f)),
        total,
        totalSize,
      },
      { excludeExtraneousValues: true },
    );
  }

  async getFiles(
    storeId: string,
    customerId: string,
    userId: string,
    options?: {
      fileType?: string;
      search?: string;
      limit?: number;
      offset?: number;
    },
  ): Promise<CustomerFileListResponseDto> {
    // Verify store ownership/access
    await this.storeService.verifyStoreOwnership(storeId, userId);

    const { files, total, totalSize } =
      await this.customerFileRepository.findByCustomer(
        storeId,
        customerId,
        options,
      );

    return plainToInstance(
      CustomerFileListResponseDto,
      {
        files: files.map((f) => this.toResponseDto(f)),
        total,
        totalSize,
      },
      { excludeExtraneousValues: true },
    );
  }

  async getFile(
    storeId: string,
    customerId: string,
    fileId: string,
    userId: string,
  ): Promise<CustomerFileResponseDto> {
    // Verify store ownership/access
    await this.storeService.verifyStoreOwnership(storeId, userId);

    const file = await this.customerFileRepository.findByStoreAndId(
      storeId,
      customerId,
      fileId,
    );

    if (!file) {
      throw new NotFoundException('File not found');
    }

    return this.toResponseDto(file);
  }

  async getFileForDownload(
    storeId: string,
    customerId: string,
    fileId: string,
    userId: string,
  ): Promise<{ path: string; fileName: string; mimeType: string }> {
    // Verify store ownership/access
    await this.storeService.verifyStoreOwnership(storeId, userId);

    const file = await this.customerFileRepository.findByStoreAndId(
      storeId,
      customerId,
      fileId,
    );

    if (!file) {
      throw new NotFoundException('File not found');
    }

    // Check if file exists on disk
    if (!fs.existsSync(file.storagePath)) {
      throw new NotFoundException('File not found on disk');
    }

    return {
      path: file.storagePath,
      fileName: file.originalName,
      mimeType: file.mimeType,
    };
  }

  /**
   * Get file for download by fileId only (store-level endpoint)
   * Validates that staff can only download files from their assigned customers
   */
  async getFileForDownloadById(
    storeId: string,
    fileId: string,
    userId: string,
    userRole: string,
  ): Promise<{ path: string; fileName: string; mimeType: string }> {
    // Verify store ownership/access
    await this.storeService.verifyStoreOwnership(storeId, userId);

    const file = await this.customerFileRepository.findById(fileId);

    if (!file || file.storeId !== storeId) {
      throw new NotFoundException('File not found');
    }

    // If staff, verify they have access to this customer's files
    if (userRole === 'staff') {
      const staffMember =
        await this.staffMemberRepository.findByUserIdAndStoreId(
          userId,
          storeId,
        );
      if (!staffMember) {
        throw new ForbiddenException('Staff member not found');
      }

      // Check if staff has any appointments with this customer
      const { files } = await this.customerFileRepository.findByStore(storeId, {
        staffId: staffMember.id,
        limit: 1,
      });

      const hasAccess = files.some((f) => f.customerId === file.customerId);
      if (!hasAccess) {
        // Do a more thorough check
        const allStaffFiles = await this.customerFileRepository.findByStore(
          storeId,
          { staffId: staffMember.id },
        );
        const customerIds = new Set(
          allStaffFiles.files.map((f) => f.customerId),
        );
        if (!customerIds.has(file.customerId)) {
          throw new ForbiddenException(
            "You do not have access to this customer's files",
          );
        }
      }
    }

    // Check if file exists on disk
    if (!fs.existsSync(file.storagePath)) {
      throw new NotFoundException('File not found on disk');
    }

    return {
      path: file.storagePath,
      fileName: file.originalName,
      mimeType: file.mimeType,
    };
  }

  async updateFile(
    storeId: string,
    customerId: string,
    fileId: string,
    userId: string,
    updateDto: UpdateCustomerFileDto,
  ): Promise<CustomerFileResponseDto> {
    // Verify store ownership/access
    await this.storeService.verifyStoreOwnership(storeId, userId);

    const file = await this.customerFileRepository.findByStoreAndId(
      storeId,
      customerId,
      fileId,
    );

    if (!file) {
      throw new NotFoundException('File not found');
    }

    const updatedFile = await this.customerFileRepository.update(fileId, {
      description: updateDto.description,
      tags: updateDto.tags,
    });

    return this.toResponseDto(updatedFile);
  }

  async deleteFile(
    storeId: string,
    customerId: string,
    fileId: string,
    userId: string,
  ): Promise<void> {
    // Verify store ownership/access
    await this.storeService.verifyStoreOwnership(storeId, userId);

    const file = await this.customerFileRepository.findByStoreAndId(
      storeId,
      customerId,
      fileId,
    );

    if (!file) {
      throw new NotFoundException('File not found');
    }

    // Delete file from disk
    try {
      if (fs.existsSync(file.storagePath)) {
        fs.unlinkSync(file.storagePath);
      }
    } catch {
      console.error(`Failed to delete file from disk: ${file.storagePath}`);
    }

    // Delete database record
    await this.customerFileRepository.delete(fileId);
  }

  async deleteMultipleFiles(
    storeId: string,
    customerId: string,
    fileIds: string[],
    userId: string,
  ): Promise<{ deleted: number }> {
    // Verify store ownership/access
    await this.storeService.verifyStoreOwnership(storeId, userId);

    const verifiedFileIds: string[] = [];

    for (const fileId of fileIds) {
      const file = await this.customerFileRepository.findByStoreAndId(
        storeId,
        customerId,
        fileId,
      );

      if (file) {
        // Delete file from disk
        try {
          if (fs.existsSync(file.storagePath)) {
            fs.unlinkSync(file.storagePath);
          }
        } catch {
          console.error(`Failed to delete file from disk: ${file.storagePath}`);
        }

        verifiedFileIds.push(fileId);
      }
    }

    // Delete records from database
    if (verifiedFileIds.length > 0) {
      await this.customerFileRepository.deleteMany(verifiedFileIds);
    }

    return { deleted: verifiedFileIds.length };
  }

  private toResponseDto(file: {
    id: string;
    storeId: string;
    customerId: string;
    uploadedBy: string | null;
    fileName: string;
    originalName: string;
    mimeType: string;
    fileType: string;
    fileSize: number;
    description: string | null;
    tags: string[] | null;
    createdAt: Date;
    updatedAt: Date;
  }): CustomerFileResponseDto {
    const dto = plainToInstance(CustomerFileResponseDto, file, {
      excludeExtraneousValues: true,
    });

    // Generate download URL
    dto.downloadUrl = `${this.baseUrl}/api/stores/${file.storeId}/customers/${file.customerId}/files/${file.id}/download`;

    return dto;
  }
}
