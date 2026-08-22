import { apiFetch } from "@/lib/api";

export type PageResult<T> = {
  items: T[];
  page?: number;
  pageSize?: number;
  total?: number;
};

export type Schedule = {
  id: string;
  name: string;
  timezone?: string;
  shiftStartMinutes?: number;
  shiftEndMinutes?: number;
  paidBreakMinutes?: number;
  unpaidBreakMinutes?: number;
  workingWeekdays?: number[];
  effectiveFrom?: string;
  active?: boolean;
};

export type Holiday = {
  id: string;
  name: string;
  date: string;
  location?: { id: string; name: string } | null;
  optional?: boolean;
  active?: boolean;
};

export type LeaveType = {
  id: string;
  name: string;
  code?: string;
  paid?: boolean;
  balance?: number;
  active?: boolean;
};

export type LeavePolicy = {
  id: string;
  name: string;
  leaveType?: { id: string; name: string };
  annualEntitlement?: number;
  accrualFrequency?: string;
  carryForwardCap?: number | null;
  negativeBalanceAllowed?: boolean;
  effectiveFrom?: string;
  active?: boolean;
};

export type AttendanceRecord = {
  id: string;
  employee?: {
    id: string;
    firstName: string;
    lastName: string;
    preferredName?: string | null;
  };
  workDate: string;
  firstCheckIn?: string | null;
  lastCheckOut?: string | null;
  netMinutes?: number;
  overtimeMinutes?: number;
  status: string;
};

export type ClockState = {
  state: "NOT_CLOCKED_IN" | "CLOCKED_IN" | "ON_BREAK" | "CLOCKED_OUT";
  since?: string | null;
  serverTime?: string;
  workedSeconds?: number;
  attendanceAvailable?: boolean;
  availableFrom?: string | null;
  unavailableReason?: string;
};

export type AttendanceCorrection = {
  id: string;
  version: number;
  workDate: string;
  employee?: { id: string; firstName: string; lastName: string };
  requestedCheckIn?: string | null;
  requestedCheckOut?: string | null;
  reason: string;
  status: string;
  reviewerComment?: string | null;
};

export type LeaveBalance = {
  leaveTypeId?: string;
  leaveType: { id: string; name: string; code?: string };
  available?: number;
  balance?: number;
  allocated?: number;
  used?: number;
  pending?: number;
};

export type LeaveRequest = {
  id: string;
  version: number;
  employee?: {
    id: string;
    firstName: string;
    lastName: string;
    preferredName?: string | null;
  };
  leaveType: { id: string; name: string; code?: string };
  startDate: string;
  endDate: string;
  requestedUnits: number;
  status: string;
  remarks?: string | null;
  decisionComment?: string | null;
};

export type LeaveAllocation = {
  id: string;
  employee?: { id: string; firstName: string; lastName: string };
  leaveType: { id: string; name: string };
  units: number;
  source?: string;
  effectiveDate?: string;
};

export type SalaryComponent = {
  id?: string;
  code: string;
  name: string;
  componentType:
    "EARNING" | "DEDUCTION" | "EMPLOYER_CONTRIBUTION" | "BALANCING";
  calculationMode: "FIXED" | "PERCENTAGE";
  basis?: "WAGE" | "BASIC" | "COMPONENT";
  basisComponentCode?: string | null;
  value: number;
  displayOrder: number;
  taxable?: boolean;
};

export type SalaryStructure = {
  id: string;
  code?: string;
  name: string;
  currency?: string;
  effectiveFrom?: string;
  status?: string;
  version?: number;
  components?: SalaryComponent[];
  active?: boolean;
};

export type PayrollRun = {
  id: string;
  version: number;
  name?: string;
  startDate?: string;
  endDate?: string;
  period?: { id: string; name: string; startDate: string; endDate: string };
  status?: string;
  employeeCount?: number;
  grossTotal?: number;
  netTotal?: number;
  currency?: string;
  blockingExceptionCount?: number;
  netPay?: number;
  grossEarnings?: number;
  finalizedAt?: string | null;
  _count?: { records: number };
};

export type PayrollLine = {
  id: string;
  employee: {
    id: string;
    firstName: string;
    lastName: string;
    employeeCode?: string;
    loginId?: string;
  };
  payableUnits?: number;
  scheduledUnits?: number;
  grossEarnings?: number;
  deductions?: number;
  netPay?: number;
  status?: string;
  exceptions?: string[];
};

export type PayrollRunDetail = PayrollRun & {
  records?: PayrollLine[];
  exceptions?: string[];
};

export type DashboardSummary = {
  clock?: { state?: string; since?: string; workDate?: string };
  leaveBalances?: Array<{ leaveTypeId: string; units: number }>;
  team?: {
    employeeCount?: number;
    pendingLeave?: number;
    pendingCorrections?: number;
  } | null;
  payroll?: { openRuns?: number } | null;
};

type CollectionEnvelope<T> =
  | T[]
  | PageResult<T>
  | { data: T[]; meta?: { page?: number; pageSize?: number; total?: number } }
  | { records: T[]; pagination?: unknown };

export function collectionItems<T>(
  result: CollectionEnvelope<T> | null | undefined,
): T[] {
  if (!result) return [];
  if (Array.isArray(result)) return result;
  if ("items" in result) return result.items;
  if ("records" in result) return result.records;
  return result.data;
}

export function getCollection<T>(path: string) {
  return apiFetch<CollectionEnvelope<T>>(path);
}

export function postJson<T>(path: string, body: unknown) {
  return apiFetch<T>(path, { method: "POST", body: JSON.stringify(body) });
}

export function patchJson<T>(path: string, body: unknown) {
  return apiFetch<T>(path, { method: "PATCH", body: JSON.stringify(body) });
}

export function formatMinutes(value?: number) {
  if (value === undefined || value === null) return "—";
  const hours = Math.floor(value / 60);
  const minutes = Math.abs(value % 60);
  return `${hours}h ${String(minutes).padStart(2, "0")}m`;
}

export function formatClockMinutes(value?: number) {
  if (value === undefined || value === null) return "—";
  const hours = Math.floor(value / 60) % 24;
  const minutes = value % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

export function formatMoney(value?: number, currency = "INR") {
  if (value === undefined || value === null) return "—";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatDate(value?: string) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(`${value.slice(0, 10)}T00:00:00`));
}

export function formatTime(value?: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}
