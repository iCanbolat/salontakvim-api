import { CreateAppointmentDto } from './create-appointment.dto';

export class CreateCustomerAppointmentDto extends CreateAppointmentDto {
  // Customer fields are defined on CreateAppointmentDto.
  // Requiredness is enforced at the controller/service level for customer booking flow.
}
