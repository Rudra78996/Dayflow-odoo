import { relations } from "drizzle-orm";
import { users } from "./users.schema.js";
import { employeeProfiles } from "./profiles.schema.js";
import { documents } from "./documents.schema.js";
import { attendance } from "./attendance.schema.js";
import { leaveRequests } from "./leave.schema.js";
import { salaryStructures } from "./payroll.schema.js";
import { notifications } from "./notifications.schema.js";

export * from "./users.schema.js";
export * from "./profiles.schema.js";
export * from "./documents.schema.js";
export * from "./attendance.schema.js";
export * from "./leave.schema.js";
export * from "./payroll.schema.js";
export * from "./notifications.schema.js";

// relations power `db.query.users.findMany({ with: {...} })` style nested queries
export const usersRelations = relations(users, ({ one, many }) => ({
  profile: one(employeeProfiles, { fields: [users.id], references: [employeeProfiles.userId] }),
  documents: many(documents),
  attendance: many(attendance),
  leaveRequests: many(leaveRequests),
  salaryStructures: many(salaryStructures),
  notifications: many(notifications),
}));

export const employeeProfilesRelations = relations(employeeProfiles, ({ one }) => ({
  user: one(users, { fields: [employeeProfiles.userId], references: [users.id] }),
}));

export const attendanceRelations = relations(attendance, ({ one }) => ({
  user: one(users, { fields: [attendance.userId], references: [users.id] }),
}));

export const leaveRequestsRelations = relations(leaveRequests, ({ one }) => ({
  user: one(users, { fields: [leaveRequests.userId], references: [users.id] }),
  reviewer: one(users, { fields: [leaveRequests.reviewedBy], references: [users.id] }),
}));