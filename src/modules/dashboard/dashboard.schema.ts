import { z } from "zod";

export const attendanceReportQuerySchema = z.object({
  from: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "from date must be in YYYY-MM-DD format")
    .optional(),
  to: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "to date must be in YYYY-MM-DD format")
    .optional(),
  user_id: z.string().optional(),
  format: z.enum(["json", "csv"]).optional().default("json"),
});

export const salarySlipQuerySchema = z.object({
  month: z
    .string()
    .regex(/^\d{4}-\d{2}$/, "month must be in YYYY-MM format")
    .optional(),
});

export type AttendanceReportQueryInput = z.infer<typeof attendanceReportQuerySchema>;
export type SalarySlipQueryInput = z.infer<typeof salarySlipQuerySchema>;
