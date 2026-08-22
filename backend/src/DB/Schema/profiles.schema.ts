import { pgTable, uuid, varchar, date, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { users } from "./users.schema.js";

export const employmentTypeEnum = pgEnum("employment_type", ["full-time", "contract", "intern"]);

export const employeeProfiles = pgTable("employee_profiles", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().unique().references(() => users.id, { onDelete: "cascade" }),
  fullName: varchar("full_name", { length: 255 }).notNull(),
  phone: varchar("phone", { length: 20 }),
  address: varchar("address", { length: 500 }),
  profilePictureUrl: varchar("profile_picture_url", { length: 500 }),
  designation: varchar("designation", { length: 100 }),
  department: varchar("department", { length: 100 }),
  dateOfJoining: date("date_of_joining"),
  employmentType: employmentTypeEnum("employment_type").default("full-time"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});