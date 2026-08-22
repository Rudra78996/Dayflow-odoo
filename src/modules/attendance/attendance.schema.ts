import { z } from "zod";

export const attendanceQuerySchema = z.object({
  view: z.enum(["daily", "weekly"]).optional().default("daily"),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format")
    .optional(),
});

export const adminAttendanceQuerySchema = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format")
    .optional(),
});

export type AttendanceQueryInput = z.infer<typeof attendanceQuerySchema>;
export type AdminAttendanceQueryInput = z.infer<typeof adminAttendanceQuerySchema>;
