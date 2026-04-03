import { IsArray, ArrayNotEmpty, IsUUID } from 'class-validator';

export class AssignServicesDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsUUID('4', { each: true })
  serviceIds!: string[];
}

