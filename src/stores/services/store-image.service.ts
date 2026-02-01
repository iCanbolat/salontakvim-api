import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { StoreRepository } from '../repositories/store.repository';
import { FileUploadService, FILE_TYPE_CONFIGS } from '../../common/file-upload';

const MAX_STORE_IMAGES = 5;

@Injectable()
export class StoreImageService {
  constructor(
    private readonly storeRepository: StoreRepository,
    private readonly fileUploadService: FileUploadService,
  ) {}

  /**
   * Upload a new store image
   */
  async uploadStoreImage(
    storeId: string,
    file: Express.Multer.File,
  ): Promise<{ imageUrl: string; storeImages: string[] }> {
    const store = await this.storeRepository.findById(storeId);
    if (!store) {
      throw new NotFoundException('Store not found');
    }

    const currentImages = store.storeImages || [];
    if (currentImages.length >= MAX_STORE_IMAGES) {
      throw new BadRequestException(
        `Maximum of ${MAX_STORE_IMAGES} store images allowed`,
      );
    }

    // Save the file using the common file upload service
    const result = this.fileUploadService.saveFile(
      file,
      storeId,
      'store-images',
    );

    // Update store with new image URL
    const updatedImages = [...currentImages, result.fileUrl];
    await this.storeRepository.update(storeId, { storeImages: updatedImages });

    return {
      imageUrl: result.fileUrl,
      storeImages: updatedImages,
    };
  }

  /**
   * Delete a store image by URL
   */
  async deleteStoreImage(
    storeId: string,
    imageUrl: string,
  ): Promise<{ storeImages: string[] }> {
    const store = await this.storeRepository.findById(storeId);
    if (!store) {
      throw new NotFoundException('Store not found');
    }

    const currentImages = store.storeImages || [];
    if (!currentImages.includes(imageUrl)) {
      throw new NotFoundException('Image not found in store images');
    }

    // Extract fileName from URL and delete the file
    const fileName = this.extractFileNameFromUrl(imageUrl);
    if (fileName) {
      this.fileUploadService.deleteFileByPath(
        storeId,
        'store-images',
        fileName,
      );
    }

    // Update store with image removed
    const updatedImages = currentImages.filter((url) => url !== imageUrl);
    await this.storeRepository.update(storeId, { storeImages: updatedImages });

    return { storeImages: updatedImages };
  }

  /**
   * Reorder store images
   */
  async reorderStoreImages(
    storeId: string,
    imageUrls: string[],
  ): Promise<{ storeImages: string[] }> {
    const store = await this.storeRepository.findById(storeId);
    if (!store) {
      throw new NotFoundException('Store not found');
    }

    const currentImages = new Set(store.storeImages || []);
    const newOrder = new Set(imageUrls);

    // Validate that the reordered list contains exactly the same images
    if (
      currentImages.size !== newOrder.size ||
      !imageUrls.every((url) => currentImages.has(url))
    ) {
      throw new BadRequestException(
        'Reordered list must contain exactly the same images',
      );
    }

    await this.storeRepository.update(storeId, { storeImages: imageUrls });

    return { storeImages: imageUrls };
  }

  /**
   * Get store image file for serving
   */
  getStoreImageFile(storeId: string, fileName: string) {
    const fileInfo = this.fileUploadService.getFileInfo(
      storeId,
      'store-images',
      fileName,
    );

    if (!fileInfo) {
      throw new NotFoundException('Store image not found');
    }

    return fileInfo;
  }

  private extractFileNameFromUrl(url: string): string | null {
    try {
      const parts = url.split('/');
      return decodeURIComponent(parts[parts.length - 1]);
    } catch {
      return null;
    }
  }
}
