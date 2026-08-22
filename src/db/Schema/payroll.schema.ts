import { pgTable, uuid, decimal, date, timestamp } from "drizzle-orm/pg-core";
import { users } from "./users.schema.js";

export const salaryStructures = pgTable("salary_structures", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  basic: decimal("basic", { precision: 12, scale: 2 }).notNull(),
  hra: decimal("hra", { precision: 12, scale: 2 }).notNull().default("0"),
  allowances: decimal("allowances", { precision: 12, scale: 2 }).notNull().default("0"),
  deductions: decimal("deductions", { precision: 12, scale: 2 }).notNull().default("0"),
  netSalary: decimal("net_salary", { precision: 12, scale: 2 }).notNull(),
  effectiveFrom: date("effective_from").notNull(),
  updatedBy: uuid("updated_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});