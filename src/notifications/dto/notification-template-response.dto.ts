import { Expose } from 'class-transformer';
import { TemplateType } from './notification-template.dto';

export class NotificationTemplateResponseDto {
  @Expose()
  id!: number;

  @Expose()
  storeId!: number;

  @Expose()
  type!: TemplateType;

  @Expose()
  name!: string;

  @Expose()
  description!: string;

  @Expose()
  subject!: string;

  @Expose()
  htmlContent!: string;

  @Expose()
  textContent!: string;

  @Expose()
  smsContent?: string;

  @Expose()
  availableVariables!: string[];

  @Expose()
  isCustom!: boolean;

  @Expose()
  createdAt!: Date;

  @Expose()
  updatedAt!: Date;
}

