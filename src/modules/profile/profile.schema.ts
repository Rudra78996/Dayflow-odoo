import { z } from "zod";

export const updateEmployeeProfileSchema = z.object({
  full_name: z.string().min(1, "Full name cannot be empty").optional(),
  phone: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  profile_picture_url: z.string().nullable().optional(),
});

export const updateAdminProfileSchema = z.object({
  full_name: z.string().min(1, "Full name cannot be empty").optional(),
  phone: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  profile_picture_url: z.string().nullable().optional(),
  designation: z.string().nullable().optional(),
  department: z.string().nullable().optional(),
  date_of_joining: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "date_of_joining must be in YYYY-MM-DD format")
    .nullable()
    .optional(),
  employment_type: z.enum(["full-time", "contract", "intern"]).nullable().optional(),
});

export const uploadDocumentSchema = z.object({
  doc_type: z.string().min(1, "doc_type is required"),
  file_url: z.string().optional(),
});

export type UpdateEmployeeProfileInput = z.infer<typeof updateEmployeeProfileSchema>;
export type UpdateAdminProfileInput = z.infer<typeof updateAdminProfileSchema>;
export type UploadDocumentInput = z.infer<typeof uploadDocumentSchema>;
