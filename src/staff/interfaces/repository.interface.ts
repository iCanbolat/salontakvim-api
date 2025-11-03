import {
  staffMembers,
  staffInvitations,
  staffWorkingHours,
  staffBreaks,
  serviceStaff,
} from '../../db/schema';

export type StaffMember = typeof staffMembers.$inferSelect;
export type NewStaffMember = typeof staffMembers.$inferInsert;

export type StaffInvitation = typeof staffInvitations.$inferSelect;
export type NewStaffInvitation = typeof staffInvitations.$inferInsert;

export type StaffWorkingHours = typeof staffWorkingHours.$inferSelect;
export type NewStaffWorkingHours = typeof staffWorkingHours.$inferInsert;

export type StaffBreak = typeof staffBreaks.$inferSelect;
export type NewStaffBreak = typeof staffBreaks.$inferInsert;

export type ServiceStaff = typeof serviceStaff.$inferSelect;
export type NewServiceStaff = typeof serviceStaff.$inferInsert;
