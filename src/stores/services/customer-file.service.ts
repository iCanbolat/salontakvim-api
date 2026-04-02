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
import { ActivitiesService } from '../../activities/services/activities.service';
import { UserRepository } from '../../auth/repositories/user.repository';
import { NotificationService } from '../../notifications/services/notification.service';
import {
  CustomerFileResponseDto,
  CustomerFileListResponseDto,
  UpdateCustomerFileDto,
  CustomerFilePreviewContextDto,
} from '../dto';
import { plainToInstance } from 'class-transformer';
import * as fs from 'fs';
import { FileUploadService, FILE_TYPE_CONFIGS } from '../../common/file-upload';
const fsp = fs.promises;

@Injectable()
export class CustomerFileService {
  private readonly baseUrl: string;

  constructor(
    private readonly customerFileRepository: CustomerFileRepository,
    private readonly staffMemberRepository: StaffMemberRepository,
    private readonly storeService: StoreService,
    private readonly configService: ConfigService,
    private readonly activitiesService: ActivitiesService,
    private readonly userRepository: UserRepository,
    private readonly fileUploadService: FileUploadService,
    private readonly notificationService: NotificationService,
  ) {
    this.baseUrl =
      this.configService.get<string>('APP_URL') || 'http://localhost:8080';
  }

  async uploadFile(
    storeId: string,
    customerId: string,
    userId: string,
    userRole: string,
    file: Express.Multer.File,
    metadata?: {
      description?: string;
      tags?: string[];
      appointmentId?: string;
    },
  ): Promise<CustomerFileResponseDto> {
    // Verify store ownership/access
    await this.storeService.verifyStoreOwnership(storeId, userId);

    // Save file using the common file upload service
    // Path: uploads/{storeId}/customer-files/{customerId}/{fileName}
    const result = await this.fileUploadService.saveFile(
      file,
      storeId,
      'customer-files',
      customerId,
    );

    // Create database record
    const createData: CreateCustomerFileData = {
      storeId,
      customerId,
      uploadedBy: userId,
      appointmentId: metadata?.appointmentId,
      fileName: result.fileName,
      originalName: file.originalname,
      mimeType: file.mimetype,
      fileType: this.fileUploadService.getFileType(file.mimetype),
      fileSize: file.size,
      storagePath: result.storagePath,
      storageProvider: 'local',
      description: metadata?.description,
      tags: metadata?.tags,
    };

    const customerFile = await this.customerFileRepository.create(createData);

    const customerUser = await this.userRepository.findById(customerId);
    const customerName = [customerUser?.firstName, customerUser?.lastName]
      .filter(Boolean)
      .join(' ')
      .trim();
    const resolvedCustomerName =
      customerName || customerUser?.email || customerUser?.phone || 'Müşteri';

    const staffMember = await this.staffMemberRepository.findByUserIdAndStoreId(
      userId,
      storeId,
    );

    let appointmentSummary: {
      id: string;
      status: string;
      staffId: string | null;
      publicNumber: string | null;
      startDateTime: Date | null;
    } | null = null;

    if (metadata?.appointmentId) {
      appointmentSummary =
        await this.customerFileRepository.findAppointmentSummary(
          storeId,
          metadata.appointmentId,
          customerId,
        );
    }

    const actorUser = await this.userRepository.findById(userId);
    const actorName = [actorUser?.firstName, actorUser?.lastName]
      .filter(Boolean)
      .join(' ')
      .trim();
    const roleLabelByUserRole: Record<string, string> = {
      admin: 'Admin',
      manager: 'Yönetici',
      staff: 'Personel',
    };

    const fileCount = 1;
    const sizeLabel = this.fileUploadService.formatFileSize(file.size);
    const resolvedActorName =
      actorName ||
      actorUser?.email ||
      roleLabelByUserRole[userRole] ||
      'Personel';

    await this.activitiesService.recordActivity(
      storeId,
      'staff',
      `${resolvedActorName} ${resolvedCustomerName} için dosya yükledi: ${customerFile.originalName} (${sizeLabel})`,
      {
        actorUserId: userId,
        actorRole: userRole,
        staffId: staffMember?.id || null,
        staffUserId: staffMember?.userId || null,
        staffName: resolvedActorName,
        appointmentId: appointmentSummary?.id || null,
        publicNumber: appointmentSummary?.publicNumber || null,
        customerId,
        customerName: resolvedCustomerName,
        fileId: customerFile.id,
        fileName: customerFile.originalName,
        fileCount,
        fileSize: file.size,
        fileSizeLabel: sizeLabel,
        locationId: staffMember?.locationId || null,
      },
    );

    if (
      appointmentSummary &&
      (userRole === 'admin' || userRole === 'manager')
    ) {
      const appointment = appointmentSummary;

      if (appointment?.status === 'confirmed' && appointment.staffId) {
        const appointmentStaff = await this.staffMemberRepository.findById(
          appointment.staffId,
        );

        if (appointmentStaff?.userId && appointmentStaff.userId !== userId) {
          await this.notificationService.createInAppNotification(
            appointmentStaff.userId,
            storeId,
            'Randevu dosyasi yuklendi',
            `${resolvedCustomerName} icin ${customerFile.originalName} dosyasi eklendi.`,
            'appointment_file_uploaded',
            {
              appointmentId: appointment.id,
              customerId,
              fileId: customerFile.id,
              fileName: customerFile.originalName,
              publicNumber: appointment.publicNumber,
              url: `/appointments/${appointment.id}`,
            },
          );
        }
      }
    }

    return this.toResponseDto(customerFile);
  }

  async getFiles(
    storeId: string,
    customerId: string,
    userId: string,
    options?: {
      fileType?: string;
      search?: string;
      appointmentId?: string;
      limit?: number;
      page?: number;
    },
  ): Promise<CustomerFileListResponseDto> {
    // Verify store ownership/access
    await this.storeService.verifyStoreOwnership(storeId, userId);

    const result = await this.customerFileRepository.findByCustomer(
      storeId,
      customerId,
      options,
    );

    return plainToInstance(
      CustomerFileListResponseDto,
      {
        data: result.data.map((f) => this.toResponseDto(f)),
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: result.totalPages,
        totalSize: result.totalSize,
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

  async getFilePreviewContext(
    storeId: string,
    customerId: string,
    fileId: string,
    userId: string,
  ): Promise<CustomerFilePreviewContextDto> {
    await this.storeService.verifyStoreOwnership(storeId, userId);

    const file = await this.customerFileRepository.findByStoreAndId(
      storeId,
      customerId,
      fileId,
    );

    if (!file) {
      throw new NotFoundException('File not found');
    }

    if (!file.appointmentId) {
      return { appointment: null };
    }

    const appointmentSummary =
      await this.customerFileRepository.findAppointmentSummary(
        storeId,
        file.appointmentId,
        customerId,
      );

    if (!appointmentSummary?.id || !appointmentSummary.startDateTime) {
      return { appointment: null };
    }

    let staffName: string | null = null;
    if (appointmentSummary.staffId) {
      const staffMember = await this.staffMemberRepository.findById(
        appointmentSummary.staffId,
      );

      if (staffMember?.userId) {
        const staffUser = await this.userRepository.findById(
          staffMember.userId,
        );
        const resolved = [staffUser?.firstName, staffUser?.lastName]
          .filter(Boolean)
          .join(' ')
          .trim();
        staffName = resolved || staffUser?.email || null;
      }
    }

    const serviceName = appointmentSummary.serviceId
      ? await this.customerFileRepository.findServiceNameById(
          appointmentSummary.serviceId,
        )
      : null;

    return {
      appointment: {
        id: appointmentSummary.id,
        startDateTime: appointmentSummary.startDateTime,
        serviceName,
        staffName,
      },
    };
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
    const fileExists = await this.pathExists(file.storagePath);
    if (!fileExists) {
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
    userRole: string,
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

    const customerUser = await this.userRepository.findById(customerId);
    const customerName = [customerUser?.firstName, customerUser?.lastName]
      .filter(Boolean)
      .join(' ')
      .trim();
    const resolvedCustomerName =
      customerName || customerUser?.email || customerUser?.phone || 'Müşteri';

    const staffMember = await this.staffMemberRepository.findByUserIdAndStoreId(
      userId,
      storeId,
    );

    const actorUser = await this.userRepository.findById(userId);
    const actorName = [actorUser?.firstName, actorUser?.lastName]
      .filter(Boolean)
      .join(' ')
      .trim();
    const roleLabelByUserRole: Record<string, string> = {
      admin: 'Admin',
      manager: 'Yönetici',
      staff: 'Personel',
    };

    const resolvedActorName =
      actorName ||
      actorUser?.email ||
      roleLabelByUserRole[userRole] ||
      'Personel';

    let appointmentSummary: any = null;
    if (file.appointmentId) {
      appointmentSummary =
        await this.customerFileRepository.findAppointmentSummary(
          storeId,
          file.appointmentId,
          customerId,
        );
    }

    const sizeLabel = this.fileUploadService.formatFileSize(file.fileSize);

    await this.activitiesService.recordActivity(
      storeId,
      'staff',
      `${resolvedActorName} ${resolvedCustomerName} için dosya sildi: ${file.originalName} (${sizeLabel})`,
      {
        actorUserId: userId,
        actorRole: userRole,
        staffId: staffMember?.id || null,
        staffUserId: staffMember?.userId || null,
        staffName: resolvedActorName,
        appointmentId: appointmentSummary?.id || null,
        publicNumber: appointmentSummary?.publicNumber || null,
        customerId,
        customerName: resolvedCustomerName,
        fileId: file.id,
        fileName: file.originalName,
        fileSize: file.fileSize,
        fileSizeLabel: sizeLabel,
        locationId: staffMember?.locationId || null,
      },
    );

    // Delete file from disk
    try {
      const fileExists = await this.pathExists(file.storagePath);
      if (fileExists) {
        await fsp.unlink(file.storagePath);
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
    userRole: string,
  ): Promise<{ deleted: number }> {
    // Verify store ownership/access
    await this.storeService.verifyStoreOwnership(storeId, userId);

    const uniqueFileIds = Array.from(new Set(fileIds));
    if (uniqueFileIds.length === 0) {
      return { deleted: 0 };
    }

    const verifiedFileIds: string[] = [];
    const pathsToDelete: string[] = [];

    const customerUser = await this.userRepository.findById(customerId);
    const customerName = [customerUser?.firstName, customerUser?.lastName]
      .filter(Boolean)
      .join(' ')
      .trim();
    const resolvedCustomerName =
      customerName || customerUser?.email || customerUser?.phone || 'Müşteri';

    const staffMember = await this.staffMemberRepository.findByUserIdAndStoreId(
      userId,
      storeId,
    );

    const actorUser = await this.userRepository.findById(userId);
    const actorName = [actorUser?.firstName, actorUser?.lastName]
      .filter(Boolean)
      .join(' ')
      .trim();
    const roleLabelByUserRole: Record<string, string> = {
      admin: 'Admin',
      manager: 'Yönetici',
      staff: 'Personel',
    };

    const resolvedActorName =
      actorName ||
      actorUser?.email ||
      roleLabelByUserRole[userRole] ||
      'Personel';

    const files =
      await this.customerFileRepository.findByStoreAndCustomerAndIds(
        storeId,
        customerId,
        uniqueFileIds,
      );

    const appointmentIds = Array.from(
      new Set(files.map((file) => file.appointmentId).filter(Boolean)),
    ) as string[];

    const appointmentSummaries =
      await this.customerFileRepository.findAppointmentSummariesByIds(
        storeId,
        customerId,
        appointmentIds,
      );
    const appointmentById = new Map(
      appointmentSummaries.map((appointment) => [appointment.id, appointment]),
    );

    let totalDeletedSize = 0;
    const fileNameSamples: string[] = [];
    const publicNumberSamples: string[] = [];

    for (const file of files) {
      verifiedFileIds.push(file.id);
      pathsToDelete.push(file.storagePath);
      totalDeletedSize += file.fileSize || 0;

      if (fileNameSamples.length < 5) {
        fileNameSamples.push(file.originalName);
      }

      if (
        file.appointmentId &&
        publicNumberSamples.length < 5 &&
        appointmentById.get(file.appointmentId)?.publicNumber
      ) {
        publicNumberSamples.push(
          String(appointmentById.get(file.appointmentId)?.publicNumber),
        );
      }
    }

    await this.runWithConcurrency(pathsToDelete, 8, async (storagePath) => {
      try {
        const fileExists = await this.pathExists(storagePath);
        if (fileExists) {
          await fsp.unlink(storagePath);
        }
      } catch {
        console.error(`Failed to delete file from disk: ${storagePath}`);
      }
    });

    // Delete records from database
    if (verifiedFileIds.length > 0) {
      await this.customerFileRepository.deleteMany(verifiedFileIds);

      const sizeLabel = this.fileUploadService.formatFileSize(totalDeletedSize);

      await this.activitiesService.recordActivity(
        storeId,
        'staff',
        `${resolvedActorName} ${resolvedCustomerName} için ${verifiedFileIds.length} dosya sildi.`,
        {
          action: 'bulk_file_deleted',
          actorUserId: userId,
          actorRole: userRole,
          staffId: staffMember?.id || null,
          staffUserId: staffMember?.userId || null,
          staffName: resolvedActorName,
          customerId,
          customerName: resolvedCustomerName,
          deletedCount: verifiedFileIds.length,
          requestedCount: uniqueFileIds.length,
          deletedFileIds: verifiedFileIds,
          deletedFileNamesSample: fileNameSamples,
          relatedPublicNumbersSample: publicNumberSamples,
          totalDeletedSize,
          totalDeletedSizeLabel: sizeLabel,
          locationId: staffMember?.locationId || null,
        },
      );
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

  private async pathExists(pathToCheck: string): Promise<boolean> {
    try {
      await fsp.access(pathToCheck, fs.constants.F_OK);
      return true;
    } catch {
      return false;
    }
  }

  private async runWithConcurrency<T>(
    items: T[],
    concurrency: number,
    task: (item: T) => Promise<void>,
  ): Promise<void> {
    if (!items.length) {
      return;
    }

    const safeConcurrency = Math.max(1, Math.min(concurrency, items.length));
    let index = 0;

    const workers = Array.from({ length: safeConcurrency }, async () => {
      while (true) {
        const currentIndex = index;
        index += 1;

        if (currentIndex >= items.length) {
          return;
        }

        await task(items[currentIndex]);
      }
    });

    await Promise.all(workers);
  }
}
