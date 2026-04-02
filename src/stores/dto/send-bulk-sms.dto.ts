import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

export class SendBulkSmsDto {
  @IsArray()
  @IsUUID('4', { each: true })
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  customerIds: string[];

  @IsString()
  @MinLength(1)
  @MaxLength(160)
  message: string;
}
