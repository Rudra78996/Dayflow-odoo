import { z } from "zod";

export const setSalaryStructureSchema = z.object({
  basic: z.number().min(0, "Basic salary must be non-negative"),
  hra: z.number().min(0, "HRA must be non-negative").optional().default(0),
  allowances: z.number().min(0, "Allowances must be non-negative").optional().default(0),
  deductions: z.number().min(0, "Deductions must be non-negative").optional().default(0),
  effective_from: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "effective_from must be in YYYY-MM-DD format"),
});

export type SetSalaryStructureInput = z.infer<typeof setSalaryStructureSchema>;
