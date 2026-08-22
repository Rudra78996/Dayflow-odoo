import { pgTable, uuid, date, timestamp, pgEnum, unique } from "drizzle-orm/pg-core";
import { users } from "./users.schema.js";

export const attendanceStatusEnum = pgEnum("attendance_status", ["present", "absent", "half-day", "leave"]);

export const attendance = pgTable("attendance", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  date: date("date").notNull(),
  checkInTime: timestamp("check_in_time"),
  checkOutTime: timestamp("check_out_time"),
  status: attendanceStatusEnum("status").notNull().default("absent"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  userDateUnique: unique("attendance_user_date_unique").on(table.userId, table.date),
}));