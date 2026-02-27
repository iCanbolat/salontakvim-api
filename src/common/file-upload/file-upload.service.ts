import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';
const fsp = fs.promises;

export type FileCategory = 'customer-files' | 'store-images' | 'avatars';

export interface FileUploadResult {
  fileName: string;
  storagePath: string;
  fileUrl: string;
}

export interface FileTypeConfig {
  allowedMimeTypes: string[];
  maxSize: number;
  category: FileCategory;
}

// Predefined file type configurations
export const FILE_TYPE_CONFIGS: Record<string, FileTypeConfig> = {
  image: {
    allowedMimeTypes: [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'image/svg+xml',
    ],
    maxSize: 5 * 1024 * 1024, // 5MB
    category: 'store-images',
  },
  avatar: {
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
    maxSize: 5 * 1024 * 1024, // 5MB
    category: 'avatars',
  },
  document: {
    allowedMimeTypes: [
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
    ],
    maxSize: 10 * 1024 * 1024, // 10MB
    category: 'customer-files',
  },
};

@Injectable()
export class FileUploadService {
  constructor(private readonly configService: ConfigService) {}

  private get uploadDir(): string {
    return this.configService.get<string>('UPLOAD_DIR') || './uploads';
  }

  private get baseUrl(): string {
    return this.configService.get<string>('APP_URL') || 'http://localhost:8080';
  }

  private get apiPrefix(): string {
    return this.configService.get<string>('API_PREFIX') || 'api';
  }

  /**
   * Ensures that a directory exists for file storage
   * Pattern: uploads/{storeId}/{category}/[subPath]
   */
  async ensureDirectory(
    storeId: string,
    category: FileCategory,
    subPath?: string,
  ): Promise<string> {
    const parts = [this.uploadDir, storeId, category];
    if (subPath) {
      parts.push(subPath);
    }
    const dir = path.join(...parts);
    await fsp.mkdir(dir, { recursive: true });
    return dir;
  }

  /**
   * Builds a public URL for accessing the file
   */
  buildFileUrl(
    storeId: string,
    category: FileCategory,
    fileName: string,
  ): string {
    const normalizedBase = this.baseUrl.replace(/\/+$/, '');
    const prefixSegment = this.apiPrefix.replace(/^\/+|\/+$/g, '');
    const hasPrefixAlready =
      prefixSegment.length > 0 && normalizedBase.endsWith(`/${prefixSegment}`);
    const prefix =
      prefixSegment.length > 0 && !hasPrefixAlready ? `/${prefixSegment}` : '';

    return `${normalizedBase}${prefix}/stores/${storeId}/${category}/${encodeURIComponent(fileName)}`;
  }

  /**
   * Validates a file against the specified configuration
   */
  validateFile(file: Express.Multer.File, config: FileTypeConfig): void {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    if (!config.allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        `File type '${file.mimetype}' is not allowed. Allowed types: ${config.allowedMimeTypes.join(', ')}`,
      );
    }

    if (file.size > config.maxSize) {
      throw new BadRequestException(
        `File size exceeds maximum allowed size of ${this.formatFileSize(config.maxSize)}`,
      );
    }
  }

  /**
   * Saves a file to disk and returns the result
   */
  async saveFile(
    file: Express.Multer.File,
    storeId: string,
    category: FileCategory,
    subPath?: string,
    customFileName?: string,
  ): Promise<FileUploadResult> {
    const dir = await this.ensureDirectory(storeId, category, subPath);
    const fileExt =
      path.extname(file.originalname) ||
      this.getExtensionFromMime(file.mimetype);
    const fileName = customFileName
      ? `${customFileName}${fileExt}`
      : `${randomUUID()}${fileExt}`;
    const storagePath = path.join(dir, fileName);

    try {
      await fsp.writeFile(storagePath, file.buffer);
    } catch (error) {
      throw new BadRequestException('Failed to save file');
    }

    return {
      fileName,
      storagePath,
      fileUrl: this.buildFileUrl(
        storeId,
        category,
        subPath ? `${subPath}/${fileName}` : fileName,
      ),
    };
  }

  /**
   * Deletes a file from disk
   */
  async deleteFile(storagePath: string): Promise<boolean> {
    try {
      await fsp.unlink(storagePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Deletes a file by storeId, category, and fileName
   */
  async deleteFileByPath(
    storeId: string,
    category: FileCategory,
    fileName: string,
    subPath?: string,
  ): Promise<boolean> {
    const safeName = path.basename(fileName);
    const filePath = subPath
      ? path.join(this.uploadDir, storeId, category, subPath, safeName)
      : path.join(this.uploadDir, storeId, category, safeName);
    return this.deleteFile(filePath);
  }

  /**
   * Gets file info for serving/downloading
   */
  async getFileInfo(
    storeId: string,
    category: FileCategory,
    fileName: string,
    subPath?: string,
  ): Promise<{ path: string; mimeType: string; fileName: string } | null> {
    const safeName = path.basename(fileName);
    const filePath = subPath
      ? path.join(this.uploadDir, storeId, category, subPath, safeName)
      : path.join(this.uploadDir, storeId, category, safeName);

    const fileExists = await this.fileExists(filePath);
    if (!fileExists) {
      return null;
    }

    const ext = path.extname(safeName).toLowerCase();
    const mimeType = this.getMimeTypeFromExtension(ext);

    return { path: filePath, mimeType, fileName: safeName };
  }

  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fsp.access(filePath, fs.constants.F_OK);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get the storage path for a specific category and store
   */
  getStoragePath(
    storeId: string,
    category: FileCategory,
    subPath?: string,
  ): string {
    const parts = [this.uploadDir, storeId, category];
    if (subPath) {
      parts.push(subPath);
    }
    return path.join(...parts);
  }

  /**
   * Helper: Detects file type category from MIME type
   */
  getFileType(mimeType: string): 'image' | 'pdf' | 'document' | 'other' {
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

  /**
   * Helper: Format file size for display
   */
  formatFileSize(bytes: number): string {
    if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    const index = Math.min(
      units.length - 1,
      Math.floor(Math.log(bytes) / Math.log(1024)),
    );
    const value = bytes / 1024 ** index;
    return `${value.toFixed(value >= 10 || index === 0 ? 0 : 1)} ${units[index]}`;
  }

  private getExtensionFromMime(mimeType: string): string {
    const mimeToExt: Record<string, string> = {
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'image/gif': '.gif',
      'image/webp': '.webp',
      'image/svg+xml': '.svg',
      'application/pdf': '.pdf',
      'text/plain': '.txt',
      'text/csv': '.csv',
    };
    return mimeToExt[mimeType] || '';
  }

  private getMimeTypeFromExtension(ext: string): string {
    const extToMime: Record<string, string> = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.svg': 'image/svg+xml',
      '.pdf': 'application/pdf',
      '.txt': 'text/plain',
      '.csv': 'text/csv',
      '.doc': 'application/msword',
      '.docx':
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.xls': 'application/vnd.ms-excel',
      '.xlsx':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    };
    return extToMime[ext] || 'application/octet-stream';
  }
}
