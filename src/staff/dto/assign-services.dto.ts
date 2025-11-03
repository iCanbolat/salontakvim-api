import { IsArray, ArrayNotEmpty, IsInt } from 'class-validator';

export class AssignServicesDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsInt({ each: true })
  serviceIds: number[];
}
