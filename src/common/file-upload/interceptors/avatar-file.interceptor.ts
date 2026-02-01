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
 * Interceptor for validating avatar file uploads
 * Use after FileInterceptor to validate the uploaded file
 *
 * @example
 * @Post('avatar')
 * @UseInterceptors(FileInterceptor('file'), AvatarFileInterceptor)
 * async uploadAvatar(@UploadedFile() file: Express.Multer.File) { ... }
 */
@Injectable()
export class AvatarFileInterceptor implements NestInterceptor {
  private readonly config = FILE_TYPE_CONFIGS.avatar;

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const file = request.file as Express.Multer.File | undefined;

    if (!file) {
      throw new BadRequestException('No file provided');
    }

    if (!this.config.allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        `Only image files are allowed for avatars. Supported types: JPEG, PNG, GIF, WebP`,
      );
    }

    if (file.size > this.config.maxSize) {
      throw new BadRequestException(
        `Avatar file size exceeds maximum allowed size of ${this.config.maxSize / 1024 / 1024}MB`,
      );
    }

    return next.handle();
  }
}
