-- CreateEnum
CREATE TYPE "AttendanceEventType" AS ENUM ('CLOCK_IN', 'BREAK_START', 'BREAK_END', 'CLOCK_OUT');

-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('PRESENT', 'ABSENT', 'HALF_DAY', 'LEAVE', 'HOLIDAY', 'WEEK_OFF', 'INCOMPLETE', 'PENDING_CORRECTION');

-- CreateEnum
CREATE TYPE "AttendanceCorrectionStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "LeaveAccrualFrequency" AS ENUM ('NONE', 'MONTHLY', 'QUARTERLY', 'ANNUAL');

-- CreateEnum
CREATE TYPE "LeaveRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "LeaveLedgerEntryType" AS ENUM ('ALLOCATION', 'ACCRUAL', 'DEBIT', 'REVERSAL', 'EXPIRY', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "DaySession" AS ENUM ('FULL_DAY', 'FIRST_HALF', 'SECOND_HALF');

-- CreateEnum
CREATE TYPE "SalaryComponentType" AS ENUM ('EARNING', 'DEDUCTION', 'EMPLOYER_CONTRIBUTION', 'BALANCING');

-- CreateEnum
CREATE TYPE "SalaryCalculationMode" AS ENUM ('FIXED', 'PERCENTAGE');

-- CreateEnum
CREATE TYPE "SalaryBasis" AS ENUM ('WAGE', 'BASIC', 'COMPONENT');

-- CreateEnum
CREATE TYPE "SalaryAssignmentStatus" AS ENUM ('DRAFT', 'ACTIVE', 'CLOSED');

-- CreateEnum
CREATE TYPE "PayrollPeriodStatus" AS ENUM ('DRAFT', 'CALCULATED', 'REVIEWED', 'FINALIZED');

-- CreateTable
CREATE TABLE "WorkSchedule" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "timezone" VARCHAR(80) NOT NULL,
    "workingWeekdays" INTEGER[],
    "shiftStartMinutes" INTEGER NOT NULL,
    "shiftEndMinutes" INTEGER NOT NULL,
    "overnight" BOOLEAN NOT NULL DEFAULT false,
    "paidBreakMinutes" INTEGER NOT NULL DEFAULT 0,
    "unpaidBreakMinutes" INTEGER NOT NULL DEFAULT 0,
    "graceMinutes" INTEGER NOT NULL DEFAULT 0,
    "halfDayMinutes" INTEGER NOT NULL,
    "fullDayMinutes" INTEGER NOT NULL,
    "overtimeAfterMinutes" INTEGER NOT NULL,
    "effectiveFrom" DATE NOT NULL,
    "effectiveTo" DATE,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "WorkSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkScheduleAssignment" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "employeeId" UUID NOT NULL,
    "scheduleId" UUID NOT NULL,
    "effectiveFrom" DATE NOT NULL,
    "effectiveTo" DATE,
    "primary" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkScheduleAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Holiday" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "locationId" UUID,
    "name" VARCHAR(160) NOT NULL,
    "date" DATE NOT NULL,
    "optional" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Holiday_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttendanceEvent" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "employeeId" UUID NOT NULL,
    "eventType" "AttendanceEventType" NOT NULL,
    "occurredAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "workDate" DATE NOT NULL,
    "timezone" VARCHAR(80) NOT NULL,
    "idempotencyKey" VARCHAR(120) NOT NULL,
    "actorUserId" UUID NOT NULL,
    "clientOccurredAt" TIMESTAMPTZ(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AttendanceEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttendanceRecord" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "employeeId" UUID NOT NULL,
    "workDate" DATE NOT NULL,
    "scheduleId" UUID,
    "firstCheckIn" TIMESTAMPTZ(3),
    "lastCheckOut" TIMESTAMPTZ(3),
    "grossMinutes" INTEGER NOT NULL DEFAULT 0,
    "paidBreakMinutes" INTEGER NOT NULL DEFAULT 0,
    "unpaidBreakMinutes" INTEGER NOT NULL DEFAULT 0,
    "netMinutes" INTEGER NOT NULL DEFAULT 0,
    "overtimeMinutes" INTEGER NOT NULL DEFAULT 0,
    "payableUnits" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "status" "AttendanceStatus" NOT NULL,
    "lockedAt" TIMESTAMPTZ(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "calculatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AttendanceRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttendanceCorrection" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "attendanceRecordId" UUID NOT NULL,
    "employeeId" UUID NOT NULL,
    "requestedCheckIn" TIMESTAMPTZ(3),
    "requestedCheckOut" TIMESTAMPTZ(3),
    "reason" VARCHAR(1000) NOT NULL,
    "status" "AttendanceCorrectionStatus" NOT NULL DEFAULT 'PENDING',
    "decisionComment" VARCHAR(1000),
    "requestedById" UUID NOT NULL,
    "decidedById" UUID,
    "decidedAt" TIMESTAMPTZ(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "AttendanceCorrection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeaveType" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "code" VARCHAR(40) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "paid" BOOLEAN NOT NULL,
    "color" VARCHAR(20) NOT NULL,
    "attachmentAfterUnits" DECIMAL(5,2),
    "halfDaySupported" BOOLEAN NOT NULL DEFAULT true,
    "approvalRequired" BOOLEAN NOT NULL DEFAULT true,
    "allowNegative" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "LeaveType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeavePolicy" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "leaveTypeId" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "annualEntitlement" DECIMAL(6,2) NOT NULL,
    "accrualFrequency" "LeaveAccrualFrequency" NOT NULL DEFAULT 'ANNUAL',
    "carryForward" BOOLEAN NOT NULL DEFAULT false,
    "carryForwardCap" DECIMAL(6,2),
    "carryForwardExpiryMonths" INTEGER,
    "prorateJoining" BOOLEAN NOT NULL DEFAULT true,
    "excludeWeekends" BOOLEAN NOT NULL DEFAULT true,
    "excludeHolidays" BOOLEAN NOT NULL DEFAULT true,
    "cancellationAllowed" BOOLEAN NOT NULL DEFAULT true,
    "effectiveFrom" DATE NOT NULL,
    "effectiveTo" DATE,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "LeavePolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeaveRequest" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "employeeId" UUID NOT NULL,
    "leaveTypeId" UUID NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "startSession" "DaySession" NOT NULL DEFAULT 'FULL_DAY',
    "endSession" "DaySession" NOT NULL DEFAULT 'FULL_DAY',
    "requestedUnits" DECIMAL(6,2) NOT NULL,
    "remarks" VARCHAR(2000),
    "evidenceFileId" UUID,
    "status" "LeaveRequestStatus" NOT NULL DEFAULT 'PENDING',
    "decisionComment" VARCHAR(1000),
    "requestedById" UUID NOT NULL,
    "decidedById" UUID,
    "decidedAt" TIMESTAMPTZ(3),
    "cancelledAt" TIMESTAMPTZ(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "LeaveRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeaveLedgerEntry" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "employeeId" UUID NOT NULL,
    "leaveTypeId" UUID NOT NULL,
    "requestId" UUID,
    "entryType" "LeaveLedgerEntryType" NOT NULL,
    "units" DECIMAL(7,2) NOT NULL,
    "effectiveDate" DATE NOT NULL,
    "expiresAt" DATE,
    "sourceKey" VARCHAR(160) NOT NULL,
    "note" VARCHAR(500),
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeaveLedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalaryStructure" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "code" VARCHAR(40) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "currency" VARCHAR(3) NOT NULL,
    "effectiveFrom" DATE NOT NULL,
    "effectiveTo" DATE,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "SalaryStructure_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalaryComponent" (
    "id" UUID NOT NULL,
    "structureId" UUID NOT NULL,
    "code" VARCHAR(40) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "componentType" "SalaryComponentType" NOT NULL,
    "calculationMode" "SalaryCalculationMode" NOT NULL,
    "basis" "SalaryBasis",
    "basisComponentCode" VARCHAR(40),
    "value" DECIMAL(12,4) NOT NULL,
    "displayOrder" INTEGER NOT NULL,
    "taxable" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "SalaryComponent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalaryAssignment" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "employeeId" UUID NOT NULL,
    "structureId" UUID NOT NULL,
    "monthlyWage" DECIMAL(18,2) NOT NULL,
    "workingDaysPerWeek" DECIMAL(3,1) NOT NULL,
    "breakMinutes" INTEGER NOT NULL DEFAULT 0,
    "currency" VARCHAR(3) NOT NULL,
    "effectiveFrom" DATE NOT NULL,
    "effectiveTo" DATE,
    "status" "SalaryAssignmentStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "SalaryAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollPeriod" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "cutoffAt" TIMESTAMPTZ(3) NOT NULL,
    "status" "PayrollPeriodStatus" NOT NULL DEFAULT 'DRAFT',
    "calculatedAt" TIMESTAMPTZ(3),
    "reviewedAt" TIMESTAMPTZ(3),
    "finalizedAt" TIMESTAMPTZ(3),
    "finalizedById" UUID,
    "version" INTEGER NOT NULL DEFAULT 1,
    "exceptions" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "PayrollPeriod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollRecord" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "payrollPeriodId" UUID NOT NULL,
    "employeeId" UUID NOT NULL,
    "salaryAssignmentId" UUID,
    "scheduledUnits" DECIMAL(7,2) NOT NULL,
    "payableUnits" DECIMAL(7,2) NOT NULL,
    "unpaidUnits" DECIMAL(7,2) NOT NULL,
    "grossEarnings" DECIMAL(18,2) NOT NULL,
    "deductions" DECIMAL(18,2) NOT NULL,
    "employerContributions" DECIMAL(18,2) NOT NULL,
    "netPay" DECIMAL(18,2) NOT NULL,
    "componentsSnapshot" JSONB NOT NULL,
    "inputsSnapshot" JSONB NOT NULL,
    "exceptions" JSONB NOT NULL,
    "blockingExceptionCount" INTEGER NOT NULL DEFAULT 0,
    "finalizedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "PayrollRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WorkSchedule_organizationId_active_effectiveFrom_idx" ON "WorkSchedule"("organizationId", "active", "effectiveFrom");

-- CreateIndex
CREATE UNIQUE INDEX "WorkSchedule_organizationId_name_version_key" ON "WorkSchedule"("organizationId", "name", "version");

-- CreateIndex
CREATE INDEX "WorkScheduleAssignment_organizationId_employeeId_effectiveF_idx" ON "WorkScheduleAssignment"("organizationId", "employeeId", "effectiveFrom");

-- CreateIndex
CREATE INDEX "WorkScheduleAssignment_organizationId_scheduleId_idx" ON "WorkScheduleAssignment"("organizationId", "scheduleId");

-- CreateIndex
CREATE INDEX "Holiday_organizationId_date_active_idx" ON "Holiday"("organizationId", "date", "active");

-- CreateIndex
CREATE INDEX "Holiday_organizationId_locationId_date_idx" ON "Holiday"("organizationId", "locationId", "date");

-- CreateIndex
CREATE INDEX "AttendanceEvent_organizationId_employeeId_occurredAt_idx" ON "AttendanceEvent"("organizationId", "employeeId", "occurredAt");

-- CreateIndex
CREATE INDEX "AttendanceEvent_organizationId_workDate_idx" ON "AttendanceEvent"("organizationId", "workDate");

-- CreateIndex
CREATE UNIQUE INDEX "AttendanceEvent_organizationId_employeeId_idempotencyKey_key" ON "AttendanceEvent"("organizationId", "employeeId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "AttendanceRecord_organizationId_workDate_status_idx" ON "AttendanceRecord"("organizationId", "workDate", "status");

-- CreateIndex
CREATE UNIQUE INDEX "AttendanceRecord_organizationId_employeeId_workDate_key" ON "AttendanceRecord"("organizationId", "employeeId", "workDate");

-- CreateIndex
CREATE INDEX "AttendanceCorrection_organizationId_status_createdAt_idx" ON "AttendanceCorrection"("organizationId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "AttendanceCorrection_organizationId_employeeId_idx" ON "AttendanceCorrection"("organizationId", "employeeId");

-- CreateIndex
CREATE INDEX "LeaveType_organizationId_active_idx" ON "LeaveType"("organizationId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "LeaveType_organizationId_code_key" ON "LeaveType"("organizationId", "code");

-- CreateIndex
CREATE INDEX "LeavePolicy_organizationId_effectiveFrom_effectiveTo_idx" ON "LeavePolicy"("organizationId", "effectiveFrom", "effectiveTo");

-- CreateIndex
CREATE UNIQUE INDEX "LeavePolicy_organizationId_leaveTypeId_name_version_key" ON "LeavePolicy"("organizationId", "leaveTypeId", "name", "version");

-- CreateIndex
CREATE UNIQUE INDEX "LeaveRequest_evidenceFileId_key" ON "LeaveRequest"("evidenceFileId");

-- CreateIndex
CREATE INDEX "LeaveRequest_organizationId_employeeId_startDate_endDate_idx" ON "LeaveRequest"("organizationId", "employeeId", "startDate", "endDate");

-- CreateIndex
CREATE INDEX "LeaveRequest_organizationId_status_createdAt_idx" ON "LeaveRequest"("organizationId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "LeaveLedgerEntry_organizationId_employeeId_leaveTypeId_effe_idx" ON "LeaveLedgerEntry"("organizationId", "employeeId", "leaveTypeId", "effectiveDate");

-- CreateIndex
CREATE UNIQUE INDEX "LeaveLedgerEntry_organizationId_sourceKey_key" ON "LeaveLedgerEntry"("organizationId", "sourceKey");

-- CreateIndex
CREATE INDEX "SalaryStructure_organizationId_effectiveFrom_effectiveTo_idx" ON "SalaryStructure"("organizationId", "effectiveFrom", "effectiveTo");

-- CreateIndex
CREATE UNIQUE INDEX "SalaryStructure_organizationId_code_version_key" ON "SalaryStructure"("organizationId", "code", "version");

-- CreateIndex
CREATE INDEX "SalaryComponent_structureId_displayOrder_idx" ON "SalaryComponent"("structureId", "displayOrder");

-- CreateIndex
CREATE UNIQUE INDEX "SalaryComponent_structureId_code_key" ON "SalaryComponent"("structureId", "code");

-- CreateIndex
CREATE INDEX "SalaryAssignment_organizationId_employeeId_effectiveFrom_idx" ON "SalaryAssignment"("organizationId", "employeeId", "effectiveFrom");

-- CreateIndex
CREATE INDEX "PayrollPeriod_organizationId_status_idx" ON "PayrollPeriod"("organizationId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollPeriod_organizationId_startDate_endDate_key" ON "PayrollPeriod"("organizationId", "startDate", "endDate");

-- CreateIndex
CREATE INDEX "PayrollRecord_organizationId_employeeId_finalizedAt_idx" ON "PayrollRecord"("organizationId", "employeeId", "finalizedAt");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollRecord_payrollPeriodId_employeeId_key" ON "PayrollRecord"("payrollPeriodId", "employeeId");

-- AddForeignKey
ALTER TABLE "WorkSchedule" ADD CONSTRAINT "WorkSchedule_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkScheduleAssignment" ADD CONSTRAINT "WorkScheduleAssignment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkScheduleAssignment" ADD CONSTRAINT "WorkScheduleAssignment_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkScheduleAssignment" ADD CONSTRAINT "WorkScheduleAssignment_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "WorkSchedule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Holiday" ADD CONSTRAINT "Holiday_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Holiday" ADD CONSTRAINT "Holiday_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "WorkLocation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceEvent" ADD CONSTRAINT "AttendanceEvent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceEvent" ADD CONSTRAINT "AttendanceEvent_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "WorkSchedule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceCorrection" ADD CONSTRAINT "AttendanceCorrection_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceCorrection" ADD CONSTRAINT "AttendanceCorrection_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceCorrection" ADD CONSTRAINT "AttendanceCorrection_attendanceRecordId_fkey" FOREIGN KEY ("attendanceRecordId") REFERENCES "AttendanceRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveType" ADD CONSTRAINT "LeaveType_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeavePolicy" ADD CONSTRAINT "LeavePolicy_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeavePolicy" ADD CONSTRAINT "LeavePolicy_leaveTypeId_fkey" FOREIGN KEY ("leaveTypeId") REFERENCES "LeaveType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveRequest" ADD CONSTRAINT "LeaveRequest_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveRequest" ADD CONSTRAINT "LeaveRequest_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveRequest" ADD CONSTRAINT "LeaveRequest_leaveTypeId_fkey" FOREIGN KEY ("leaveTypeId") REFERENCES "LeaveType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveRequest" ADD CONSTRAINT "LeaveRequest_evidenceFileId_fkey" FOREIGN KEY ("evidenceFileId") REFERENCES "FileObject"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveLedgerEntry" ADD CONSTRAINT "LeaveLedgerEntry_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveLedgerEntry" ADD CONSTRAINT "LeaveLedgerEntry_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveLedgerEntry" ADD CONSTRAINT "LeaveLedgerEntry_leaveTypeId_fkey" FOREIGN KEY ("leaveTypeId") REFERENCES "LeaveType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveLedgerEntry" ADD CONSTRAINT "LeaveLedgerEntry_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "LeaveRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalaryStructure" ADD CONSTRAINT "SalaryStructure_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalaryComponent" ADD CONSTRAINT "SalaryComponent_structureId_fkey" FOREIGN KEY ("structureId") REFERENCES "SalaryStructure"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalaryAssignment" ADD CONSTRAINT "SalaryAssignment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalaryAssignment" ADD CONSTRAINT "SalaryAssignment_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalaryAssignment" ADD CONSTRAINT "SalaryAssignment_structureId_fkey" FOREIGN KEY ("structureId") REFERENCES "SalaryStructure"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollPeriod" ADD CONSTRAINT "PayrollPeriod_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollRecord" ADD CONSTRAINT "PayrollRecord_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollRecord" ADD CONSTRAINT "PayrollRecord_payrollPeriodId_fkey" FOREIGN KEY ("payrollPeriodId") REFERENCES "PayrollPeriod"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollRecord" ADD CONSTRAINT "PayrollRecord_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Domain invariants that Prisma cannot express in the schema.
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "WorkSchedule" ADD CONSTRAINT "WorkSchedule_thresholds_check" CHECK (
  cardinality("workingWeekdays") BETWEEN 1 AND 7
  AND "workingWeekdays" <@ ARRAY[1,2,3,4,5,6,7]
  AND "shiftStartMinutes" BETWEEN 0 AND 1439
  AND "shiftEndMinutes" BETWEEN 0 AND 1439
  AND ("overnight" OR "shiftEndMinutes" > "shiftStartMinutes")
  AND "halfDayMinutes" > 0
  AND "fullDayMinutes" > "halfDayMinutes"
  AND "overtimeAfterMinutes" >= "fullDayMinutes"
  AND ("effectiveTo" IS NULL OR "effectiveTo" >= "effectiveFrom")
);

ALTER TABLE "WorkScheduleAssignment" ADD CONSTRAINT "WorkScheduleAssignment_range_check"
  CHECK ("effectiveTo" IS NULL OR "effectiveTo" >= "effectiveFrom");
ALTER TABLE "WorkScheduleAssignment" ADD CONSTRAINT "WorkScheduleAssignment_primary_no_overlap"
  EXCLUDE USING gist (
    "organizationId" WITH =,
    "employeeId" WITH =,
    daterange("effectiveFrom", COALESCE("effectiveTo", 'infinity'::date), '[]') WITH &&
  ) WHERE ("primary");

CREATE UNIQUE INDEX "Holiday_scope_date_active_key" ON "Holiday" (
  "organizationId", COALESCE("locationId", '00000000-0000-0000-0000-000000000000'::uuid), "date"
) WHERE ("active");

ALTER TABLE "AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_values_check" CHECK (
  "grossMinutes" >= 0 AND "paidBreakMinutes" >= 0 AND "unpaidBreakMinutes" >= 0
  AND "netMinutes" >= 0 AND "overtimeMinutes" >= 0
  AND "payableUnits" BETWEEN 0 AND 1
);
CREATE UNIQUE INDEX "AttendanceCorrection_one_pending_key" ON "AttendanceCorrection" ("attendanceRecordId")
  WHERE ("status" = 'PENDING');

ALTER TABLE "LeavePolicy" ADD CONSTRAINT "LeavePolicy_values_check" CHECK (
  "annualEntitlement" >= 0
  AND ("carryForwardCap" IS NULL OR "carryForwardCap" >= 0)
  AND ("carryForwardExpiryMonths" IS NULL OR "carryForwardExpiryMonths" > 0)
  AND ("effectiveTo" IS NULL OR "effectiveTo" >= "effectiveFrom")
);
ALTER TABLE "LeaveRequest" ADD CONSTRAINT "LeaveRequest_range_check" CHECK (
  "endDate" >= "startDate" AND "requestedUnits" > 0
);
ALTER TABLE "LeaveRequest" ADD CONSTRAINT "LeaveRequest_active_no_overlap"
  EXCLUDE USING gist (
    "organizationId" WITH =,
    "employeeId" WITH =,
    daterange("startDate", "endDate", '[]') WITH &&
  ) WHERE ("status" IN ('PENDING', 'APPROVED'));
ALTER TABLE "LeaveLedgerEntry" ADD CONSTRAINT "LeaveLedgerEntry_nonzero_check" CHECK ("units" <> 0);

ALTER TABLE "SalaryComponent" ADD CONSTRAINT "SalaryComponent_value_check" CHECK (
  "value" >= 0
  AND ("calculationMode" <> 'PERCENTAGE' OR "value" <= 100)
  AND ("calculationMode" <> 'PERCENTAGE' OR "basis" IS NOT NULL)
);
ALTER TABLE "SalaryAssignment" ADD CONSTRAINT "SalaryAssignment_values_check" CHECK (
  "monthlyWage" > 0 AND "workingDaysPerWeek" BETWEEN 1 AND 7
  AND ("effectiveTo" IS NULL OR "effectiveTo" >= "effectiveFrom")
);
ALTER TABLE "SalaryAssignment" ADD CONSTRAINT "SalaryAssignment_active_no_overlap"
  EXCLUDE USING gist (
    "organizationId" WITH =,
    "employeeId" WITH =,
    daterange("effectiveFrom", COALESCE("effectiveTo", 'infinity'::date), '[]') WITH &&
  ) WHERE ("status" = 'ACTIVE');

ALTER TABLE "PayrollPeriod" ADD CONSTRAINT "PayrollPeriod_range_check" CHECK (
  "endDate" >= "startDate" AND "endDate" - "startDate" <= 45
);
ALTER TABLE "PayrollRecord" ADD CONSTRAINT "PayrollRecord_values_check" CHECK (
  "scheduledUnits" >= 0 AND "payableUnits" >= 0 AND "payableUnits" <= "scheduledUnits"
  AND "unpaidUnits" >= 0 AND "grossEarnings" >= 0 AND "deductions" >= 0
  AND "employerContributions" >= 0
);
