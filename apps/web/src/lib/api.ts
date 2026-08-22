export const API_URL =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ??
  "http://localhost:3001/v1";

type ApiErrorBody = {
  message?: string | string[];
  code?: string;
};

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function apiFetch<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  let response = await fetch(`${API_URL}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      ...(init.body ? { "content-type": "application/json" } : {}),
      ...init.headers,
    },
  });
  if (
    response.status === 401 &&
    !["/auth/sign-in", "/auth/refresh", "/auth/company-sign-up"].includes(path)
  ) {
    const refreshed = await fetch(`${API_URL}/auth/refresh`, {
      method: "POST",
      credentials: "include",
    });
    if (refreshed.ok) {
      response = await fetch(`${API_URL}${path}`, {
        ...init,
        credentials: "include",
        headers: {
          ...(init.body ? { "content-type": "application/json" } : {}),
          ...init.headers,
        },
      });
    }
  }
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as ApiErrorBody;
    const message = Array.isArray(body.message)
      ? body.message.join(" ")
      : body.message || "Something went wrong. Please try again.";
    throw new ApiError(message, response.status, body.code);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export type SessionUser = {
  id: string;
  organizationId: string;
  employeeId?: string;
  roles: Array<"ADMIN" | "HR_OFFICER" | "EMPLOYEE">;
};

export type CurrentAccount = {
  id: string;
  email: string;
  status: string;
  organization: { id: string; displayName: string; timezone: string; currency: string };
  roles: Array<{ role: { code: "ADMIN" | "HR_OFFICER" | "EMPLOYEE"; name: string } }>;
  employee?: {
    id: string;
    loginId: string;
    employeeCode: string;
    firstName: string;
    lastName: string;
    preferredName?: string | null;
    jobTitle?: string | null;
  } | null;
};

export type EmployeeListItem = {
  id: string;
  loginId: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
  preferredName?: string | null;
  workEmail?: string | null;
  workPhone?: string | null;
  jobTitle?: string | null;
  employmentStatus: string;
  attendanceRecords?: Array<{ status: string }>;
  assignments: Array<{
    department?: { id: string; name: string } | null;
    location?: { id: string; name: string } | null;
    manager?: {
      id: string;
      firstName: string;
      lastName: string;
      preferredName?: string | null;
    } | null;
  }>;
};

export type EmployeeSummary = EmployeeListItem & {
  middleName?: string | null;
  dateOfJoining: string;
  version: number;
  user?: { email: string; status: "INVITED" | "ACTIVE" | "SUSPENDED" | "ARCHIVED" } | null;
  resume?: {
    about?: string | null;
    jobLove?: string | null;
    interests?: string | null;
  } | null;
  skills: Array<{
    proficiency?: number | null;
    skill: { id: string; name: string };
  }>;
  certifications: Array<{
    id: string;
    name: string;
    issuer?: string | null;
    issuedAt?: string | null;
    expiresAt?: string | null;
    credentialId?: string | null;
    credentialUrl?: string | null;
  }>;
};
