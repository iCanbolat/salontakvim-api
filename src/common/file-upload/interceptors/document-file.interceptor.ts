import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  BadRequestException,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { FILE_TYPE_CONFIGS } from '../file-upload.service';

/**
 * Interceptor for validating document file uploads (images, PDFs, office documents)
 * Use after FileInterceptor to validate the uploaded file
 *
 * @example
 * @Post('upload')
 * @UseInterceptors(FileInterceptor('file'), DocumentFileInterceptor)
 * async upload(@UploadedFile() file: Express.Multer.File) { ... }
 */
@Injectable()
export class DocumentFileInterceptor implements NestInterceptor {
  private readonly config = FILE_TYPE_CONFIGS.document;

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const file = request.file as Express.Multer.File | undefined;

    if (!file) {
      throw new BadRequestException('No file provided');
    }

    if (!this.config.allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        `File type '${file.mimetype}' is not allowed. Allowed types: images, PDFs, and common documents`,
      );
    }

    if (file.size > this.config.maxSize) {
      throw new BadRequestException(
        `File size exceeds maximum allowed size of ${this.config.maxSize / 1024 / 1024}MB`,
      );
    }

    return next.handle();
  }
}
