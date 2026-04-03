import { Expose } from 'class-transformer';

export class WidgetEmbedCodeResponseDto {
  @Expose()
  widgetKey!: string;

  @Expose()
  embedCode!: string;

  @Expose()
  scriptUrl!: string;

  @Expose()
  iframeCode!: string;

  constructor(partial: Partial<WidgetEmbedCodeResponseDto>) {
    Object.assign(this, partial);
  }
}

