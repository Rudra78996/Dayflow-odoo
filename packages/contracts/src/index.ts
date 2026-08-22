export const roleCodes = ["ADMIN", "HR_OFFICER", "EMPLOYEE"] as const;
export type RoleCode = (typeof roleCodes)[number];

export type ApiErrorEnvelope = {
  statusCode: number;
  code: string;
  message: string | string[];
  requestId?: string;
  path?: string;
  timestamp?: string;
};

export type PageMeta = {
  page: number;
  limit: number;
  total: number;
  pages: number;
};
