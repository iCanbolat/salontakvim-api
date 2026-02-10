import {
  Controller,
  Get,
  Param,
  Query,
  ParseUUIDPipe,
  Res,
  StreamableFile,
} from '@nestjs/common';
import type { Response } from 'express';
import { createReadStream } from 'fs';
import { CustomerFileService } from './services/customer-file.service';
import { CustomerFileListResponseDto } from './dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import type { JwtPayload } from '../auth/interfaces/auth.interface';

/**
 * Store-level file management controller
 * Provides endpoints for listing all customer files in a store
 * Admin sees all files, staff only sees files from their assigned customers
 */
@Controller('stores/:storeId/files')
export class StoreFilesController {
  constructor(private readonly customerFileService: CustomerFileService) {}

  @Get()
  @Roles('admin', 'manager', 'staff')
  async getAllStoreFiles(
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @CurrentUser() user: JwtPayload,
    @Query('fileType') fileType?: string,
    @Query('search') search?: string,
    @Query('limit') limit?: string,
    @Query('page') page?: string,
  ): Promise<CustomerFileListResponseDto> {
    return this.customerFileService.getAllStoreFiles(
      storeId,
      user.sub,
      user.role,
      {
        fileType,
        search,
        limit: limit ? parseInt(limit, 10) : undefined,
        page: page ? parseInt(page, 10) : undefined,
      },
    );
  }

  @Get('folders')
  @Roles('admin', 'manager', 'staff')
  async getFolders(
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @CurrentUser() user: JwtPayload,
    @Query('search') search?: string,
    @Query('limit') limit?: string,
    @Query('page') page?: string,
  ) {
    return this.customerFileService.getFolders(storeId, user.sub, user.role, {
      search,
      limit: limit ? parseInt(limit, 10) : undefined,
      page: page ? parseInt(page, 10) : undefined,
    });
  }

  @Get(':fileId/download')
  @Roles('admin', 'manager', 'staff')
  async downloadFile(
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Param('fileId', ParseUUIDPipe) fileId: string,
    @CurrentUser() user: JwtPayload,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const fileInfo = await this.customerFileService.getFileForDownloadById(
      storeId,
      fileId,
      user.sub,
      user.role,
    );

    res.set({
      'Content-Type': fileInfo.mimeType,
      'Content-Disposition': `attachment; filename="${encodeURIComponent(fileInfo.fileName)}"`,
    });

    const fileStream = createReadStream(fileInfo.path);
    return new StreamableFile(fileStream);
  }
}
