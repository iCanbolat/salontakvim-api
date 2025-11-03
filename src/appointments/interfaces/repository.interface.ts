import type * as schema from '../../db/schema';

export type Appointment = typeof schema.appointments.$inferSelect;
export type NewAppointment = typeof schema.appointments.$inferInsert;

export type AppointmentExtra = typeof schema.appointmentExtras.$inferSelect;
export type NewAppointmentExtra = typeof schema.appointmentExtras.$inferInsert;
