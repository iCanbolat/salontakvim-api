import { CreateAppointmentDto } from './create-appointment.dto';

export class CreateGuestAppointmentDto extends CreateAppointmentDto {
  // Guest fields are defined on CreateAppointmentDto.
  // Requiredness is enforced at the controller/service level when using guest flow.
}
