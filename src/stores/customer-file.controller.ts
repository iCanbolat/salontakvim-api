import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
  UseInterceptors,
  UploadedFile,
  Res,
  StreamableFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { createReadStream } from 'fs';
import { CustomerFileService } from './services/customer-file.service';
import {
  CustomerFileResponseDto,
  CustomerFileListResponseDto,
  UpdateCustomerFileDto,
  UploadCustomerFileDto,
} from './dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import type { JwtPayload } from '../auth/interfaces/auth.interface';

@Controller('stores/:storeId/customers/:customerId/files')
export class CustomerFileController {
  constructor(private readonly customerFileService: CustomerFileService) {}

  @Post()
  @Roles('admin', 'staff')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB
      },
    }),
  )
  async uploadFile(
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Param('customerId', ParseUUIDPipe) customerId: string,
    @CurrentUser() user: JwtPayload,
    @UploadedFile() file: Express.Multer.File,
    @Body() body: UploadCustomerFileDto,
  ): Promise<CustomerFileResponseDto> {
    return this.customerFileService.uploadFile(
      storeId,
      customerId,
      user.sub,
      file,
      { description: body.description, tags: body.tags },
    );
  }

  @Get()
  @Roles('admin', 'staff')
  async getFiles(
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Param('customerId', ParseUUIDPipe) customerId: string,
    @CurrentUser() user: JwtPayload,
    @Query('fileType') fileType?: string,
    @Query('search') search?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ): Promise<CustomerFileListResponseDto> {
    return this.customerFileService.getFiles(storeId, customerId, user.sub, {
      fileType,
      search,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });
  }

  @Get(':fileId')
  @Roles('admin', 'staff')
  async getFile(
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Param('customerId', ParseUUIDPipe) customerId: string,
    @Param('fileId', ParseUUIDPipe) fileId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<CustomerFileResponseDto> {
    return this.customerFileService.getFile(
      storeId,
      customerId,
      fileId,
      user.sub,
    );
  }

  @Get(':fileId/download')
  @Roles('admin', 'staff')
  async downloadFile(
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Param('customerId', ParseUUIDPipe) customerId: string,
    @Param('fileId', ParseUUIDPipe) fileId: string,
    @CurrentUser() user: JwtPayload,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const fileInfo = await this.customerFileService.getFileForDownload(
      storeId,
      customerId,
      fileId,
      user.sub,
    );

    res.set({
      'Content-Type': fileInfo.mimeType,
      'Content-Disposition': `attachment; filename="${encodeURIComponent(fileInfo.fileName)}"`,
    });

    const fileStream = createReadStream(fileInfo.path);
    return new StreamableFile(fileStream);
  }

  @Patch(':fileId')
  @Roles('admin', 'staff')
  async updateFile(
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Param('customerId', ParseUUIDPipe) customerId: string,
    @Param('fileId', ParseUUIDPipe) fileId: string,
    @CurrentUser() user: JwtPayload,
    @Body() updateDto: UpdateCustomerFileDto,
  ): Promise<CustomerFileResponseDto> {
    return this.customerFileService.updateFile(
      storeId,
      customerId,
      fileId,
      user.sub,
      updateDto,
    );
  }

  @Delete(':fileId')
  @Roles('admin', 'staff')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteFile(
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Param('customerId', ParseUUIDPipe) customerId: string,
    @Param('fileId', ParseUUIDPipe) fileId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<void> {
    return this.customerFileService.deleteFile(
      storeId,
      customerId,
      fileId,
      user.sub,
    );
  }

  @Delete()
  @Roles('admin', 'staff')
  @HttpCode(HttpStatus.OK)
  async deleteMultipleFiles(
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Param('customerId', ParseUUIDPipe) customerId: string,
    @CurrentUser() user: JwtPayload,
    @Body('fileIds') fileIds: string[],
  ): Promise<{ deleted: number }> {
    return this.customerFileService.deleteMultipleFiles(
      storeId,
      customerId,
      fileIds,
      user.sub,
    );
  }
}
