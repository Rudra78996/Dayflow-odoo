import { pgTable, uuid, varchar, timestamp } from "drizzle-orm/pg-core";
import { users } from "./users.schema.js";

export const documents = pgTable("documents", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  docType: varchar("doc_type", { length: 100 }).notNull(),
  fileUrl: varchar("file_url", { length: 500 }).notNull(),
  uploadedAt: timestamp("uploaded_at").notNull().defaultNow(),
});