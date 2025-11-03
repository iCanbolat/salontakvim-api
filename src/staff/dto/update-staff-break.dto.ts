import { PartialType } from '@nestjs/mapped-types';
import { CreateStaffBreakDto } from './create-staff-break.dto';

export class UpdateStaffBreakDto extends PartialType(CreateStaffBreakDto) {}
