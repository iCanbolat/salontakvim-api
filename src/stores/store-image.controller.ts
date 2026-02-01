import {
  Controller,
  Get,
  Post,
  Delete,
  Patch,
  Param,
  Body,
  ParseUUIDPipe,
  UseInterceptors,
  UploadedFile,
  Res,
  StreamableFile,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { createReadStream } from 'fs';
import { StoreImageService } from './services/store-image.service';
import { StoreService } from './services/store.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { ImageFileInterceptor } from '../common/file-upload';
import type { JwtPayload } from '../auth/interfaces/auth.interface';

@Controller('stores/:storeId/store-images')
export class StoreImageController {
  constructor(
    private readonly storeImageService: StoreImageService,
    private readonly storeService: StoreService,
  ) {}

  /**
   * Upload a new store image
   * Only store owners (admins) can upload images
   */
  @Post()
  @Roles('admin')
  @UseInterceptors(FileInterceptor('file'), ImageFileInterceptor)
  async uploadImage(
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @CurrentUser() user: JwtPayload,
    @UploadedFile() file: Express.Multer.File,
  ) {
    // Verify store ownership
    await this.storeService.verifyStoreOwnership(storeId, user.sub);
    return this.storeImageService.uploadStoreImage(storeId, file);
  }

  /**
   * Delete a store image
   */
  @Delete()
  @Roles('admin')
  @HttpCode(HttpStatus.OK)
  async deleteImage(
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @CurrentUser() user: JwtPayload,
    @Body('imageUrl') imageUrl: string,
  ) {
    // Verify store ownership
    await this.storeService.verifyStoreOwnership(storeId, user.sub);
    return this.storeImageService.deleteStoreImage(storeId, imageUrl);
  }

  /**
   * Reorder store images
   */
  @Patch('reorder')
  @Roles('admin')
  async reorderImages(
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @CurrentUser() user: JwtPayload,
    @Body('imageUrls') imageUrls: string[],
  ) {
    // Verify store ownership
    await this.storeService.verifyStoreOwnership(storeId, user.sub);
    return this.storeImageService.reorderStoreImages(storeId, imageUrls);
  }

  /**
   * Serve a store image file (public access for widget display)
   */
  @Get(':fileName')
  @Public()
  async getImage(
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Param('fileName') fileName: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const fileInfo = this.storeImageService.getStoreImageFile(
      storeId,
      fileName,
    );

    res.set({
      'Content-Type': fileInfo.mimeType,
      'Cache-Control': 'public, max-age=31536000', // Cache for 1 year
    });

    const fileStream = createReadStream(fileInfo.path);
    return new StreamableFile(fileStream);
  }
}
