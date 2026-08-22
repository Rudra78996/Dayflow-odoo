import { z } from "zod";

export const applyLeaveSchema = z.object({
  leave_type: z.enum(["paid", "sick", "unpaid"]),
  start_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "start_date must be in YYYY-MM-DD format"),
  end_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "end_date must be in YYYY-MM-DD format"),
  remarks: z.string().nullable().optional(),
});

export const leaveDecisionSchema = z.object({
  decision: z.enum(["approved", "rejected"]),
  admin_comment: z.string().nullable().optional(),
});

export const myLeaveQuerySchema = z.object({
  status: z.enum(["pending", "approved", "rejected"]).optional(),
});

export const adminLeaveQuerySchema = z.object({
  status: z.enum(["pending", "approved", "rejected"]).optional(),
  user_id: z.string().optional(),
  page: z.coerce.number().optional().default(1),
  limit: z.coerce.number().optional().default(10),
});

export type ApplyLeaveInput = z.infer<typeof applyLeaveSchema>;
export type LeaveDecisionInput = z.infer<typeof leaveDecisionSchema>;
export type MyLeaveQueryInput = z.infer<typeof myLeaveQuerySchema>;
export type AdminLeaveQueryInput = z.infer<typeof adminLeaveQuerySchema>;
