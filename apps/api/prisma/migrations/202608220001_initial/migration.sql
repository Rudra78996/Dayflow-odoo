-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "OrganizationStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'DEACTIVATED');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('DRAFT', 'INVITED', 'ACTIVE', 'SUSPENDED', 'DEACTIVATED');

-- CreateEnum
CREATE TYPE "RoleCode" AS ENUM ('ADMIN', 'HR_OFFICER', 'EMPLOYEE');

-- CreateEnum
CREATE TYPE "EmploymentStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ON_LEAVE', 'TERMINATED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "TokenPurpose" AS ENUM ('VERIFY_EMAIL', 'ACTIVATE_ACCOUNT', 'RESET_PASSWORD');

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('FEMALE', 'MALE', 'NON_BINARY', 'PREFER_NOT_TO_SAY', 'OTHER');

-- CreateEnum
CREATE TYPE "MaritalStatus" AS ENUM ('SINGLE', 'MARRIED', 'DIVORCED', 'WIDOWED', 'OTHER');

-- CreateEnum
CREATE TYPE "FileClassification" AS ENUM ('PUBLIC_WORKPLACE', 'INTERNAL', 'CONFIDENTIAL_HR', 'RESTRICTED');

-- CreateEnum
CREATE TYPE "FileScanStatus" AS ENUM ('PENDING_UPLOAD', 'PENDING_SCAN', 'CLEAN', 'REJECTED');

-- CreateEnum
CREATE TYPE "AuditResult" AS ENUM ('SUCCESS', 'DENIED', 'FAILURE');

-- CreateEnum
CREATE TYPE "OutboxStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "Organization" (
    "id" UUID NOT NULL,
    "legalName" VARCHAR(180) NOT NULL,
    "displayName" VARCHAR(120) NOT NULL,
    "slug" VARCHAR(120) NOT NULL,
    "companyPrefix" VARCHAR(4) NOT NULL,
    "timezone" VARCHAR(80) NOT NULL DEFAULT 'Asia/Kolkata',
    "currency" VARCHAR(3) NOT NULL DEFAULT 'INR',
    "locale" VARCHAR(20) NOT NULL DEFAULT 'en-IN',
    "logoFileId" UUID,
    "status" "OrganizationStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "archivedAt" TIMESTAMPTZ(3),

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganizationSequence" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "sequenceType" VARCHAR(40) NOT NULL,
    "year" INTEGER NOT NULL,
    "nextValue" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "OrganizationSequence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "email" VARCHAR(254) NOT NULL,
    "emailNormalized" VARCHAR(254) NOT NULL,
    "passwordHash" VARCHAR(255),
    "status" "UserStatus" NOT NULL DEFAULT 'INVITED',
    "emailVerifiedAt" TIMESTAMPTZ(3),
    "lastLoginAt" TIMESTAMPTZ(3),
    "passwordChangedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "archivedAt" TIMESTAMPTZ(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Role" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "code" "RoleCode" NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "permissions" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserRole" (
    "userId" UUID NOT NULL,
    "roleId" UUID NOT NULL,
    "assignedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assignedBy" UUID,

    CONSTRAINT "UserRole_pkey" PRIMARY KEY ("userId","roleId")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "tokenHash" CHAR(64) NOT NULL,
    "familyId" UUID NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "lastUsedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMPTZ(3),
    "ipAddress" VARCHAR(64),
    "userAgent" VARCHAR(500),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "purpose" "TokenPurpose" NOT NULL,
    "tokenHash" CHAR(64) NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "consumedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VerificationToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Department" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "code" VARCHAR(30) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Department_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkLocation" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "timezone" VARCHAR(80) NOT NULL,
    "address" JSONB,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "WorkLocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Employee" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "userId" UUID,
    "loginId" VARCHAR(40) NOT NULL,
    "employeeCode" VARCHAR(40) NOT NULL,
    "firstName" VARCHAR(100) NOT NULL,
    "middleName" VARCHAR(100),
    "lastName" VARCHAR(100) NOT NULL,
    "preferredName" VARCHAR(100),
    "workEmail" VARCHAR(254) NOT NULL,
    "workPhone" VARCHAR(40),
    "jobTitle" VARCHAR(120),
    "dateOfJoining" DATE NOT NULL,
    "employmentStatus" "EmploymentStatus" NOT NULL DEFAULT 'DRAFT',
    "avatarFileId" UUID,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "archivedAt" TIMESTAMPTZ(3),

    CONSTRAINT "Employee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmploymentAssignment" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "employeeId" UUID NOT NULL,
    "departmentId" UUID,
    "locationId" UUID,
    "managerId" UUID,
    "jobTitle" VARCHAR(120),
    "effectiveFrom" DATE NOT NULL,
    "effectiveTo" DATE,
    "primary" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "EmploymentAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeePrivateProfile" (
    "employeeId" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "dateOfBirth" DATE,
    "residentialAddress" JSONB,
    "nationality" VARCHAR(80),
    "personalEmail" VARCHAR(254),
    "personalPhone" VARCHAR(40),
    "gender" "Gender",
    "maritalStatus" "MaritalStatus",
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "EmployeePrivateProfile_pkey" PRIMARY KEY ("employeeId")
);

-- CreateTable
CREATE TABLE "EmployeeBankDetail" (
    "employeeId" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "accountHolderName" VARCHAR(180),
    "accountNumberEncrypted" TEXT,
    "accountNumberLast4" CHAR(4),
    "bankName" VARCHAR(160),
    "ifscEncrypted" TEXT,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "EmployeeBankDetail_pkey" PRIMARY KEY ("employeeId")
);

-- CreateTable
CREATE TABLE "EmployeeStatutoryDetail" (
    "employeeId" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "panEncrypted" TEXT,
    "panLast4" CHAR(4),
    "uanEncrypted" TEXT,
    "uanLast4" CHAR(4),
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "EmployeeStatutoryDetail_pkey" PRIMARY KEY ("employeeId")
);

-- CreateTable
CREATE TABLE "EmployeeResume" (
    "employeeId" UUID NOT NULL,
    "about" TEXT,
    "jobLove" TEXT,
    "interests" TEXT,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "EmployeeResume_pkey" PRIMARY KEY ("employeeId")
);

-- CreateTable
CREATE TABLE "Skill" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "normalizedName" VARCHAR(100) NOT NULL,

    CONSTRAINT "Skill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeSkill" (
    "employeeId" UUID NOT NULL,
    "skillId" UUID NOT NULL,
    "proficiency" INTEGER,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmployeeSkill_pkey" PRIMARY KEY ("employeeId","skillId")
);

-- CreateTable
CREATE TABLE "Certification" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "employeeId" UUID NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "issuer" VARCHAR(160),
    "issuedAt" DATE,
    "expiresAt" DATE,
    "credentialId" VARCHAR(160),
    "credentialUrl" VARCHAR(500),
    "fileId" UUID,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Certification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FileObject" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "employeeId" UUID,
    "bucket" VARCHAR(120) NOT NULL,
    "objectKey" VARCHAR(600) NOT NULL,
    "originalName" VARCHAR(255) NOT NULL,
    "mimeType" VARCHAR(120) NOT NULL,
    "sizeBytes" BIGINT NOT NULL,
    "checksumSha256" CHAR(64) NOT NULL,
    "classification" "FileClassification" NOT NULL,
    "scanStatus" "FileScanStatus" NOT NULL DEFAULT 'PENDING_UPLOAD',
    "uploadedAt" TIMESTAMPTZ(3),
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "FileObject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "actorUserId" UUID,
    "action" VARCHAR(100) NOT NULL,
    "resourceType" VARCHAR(80) NOT NULL,
    "resourceId" VARCHAR(120),
    "result" "AuditResult" NOT NULL DEFAULT 'SUCCESS',
    "changes" JSONB,
    "context" JSONB,
    "requestId" VARCHAR(100),
    "ipAddress" VARCHAR(64),
    "userAgent" VARCHAR(500),
    "occurredAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutboxEvent" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "aggregateType" VARCHAR(80) NOT NULL,
    "aggregateId" VARCHAR(120) NOT NULL,
    "eventType" VARCHAR(120) NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "OutboxStatus" NOT NULL DEFAULT 'PENDING',
    "availableAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMPTZ(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OutboxEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IdempotencyRecord" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "scope" VARCHAR(120) NOT NULL,
    "key" VARCHAR(120) NOT NULL,
    "requestHash" CHAR(64) NOT NULL,
    "responseStatus" INTEGER,
    "responseBody" JSONB,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IdempotencyRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Organization_companyPrefix_key" ON "Organization"("companyPrefix");

-- CreateIndex
CREATE INDEX "Organization_status_idx" ON "Organization"("status");

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationSequence_organizationId_sequenceType_year_key" ON "OrganizationSequence"("organizationId", "sequenceType", "year");

-- CreateIndex
CREATE INDEX "User_organizationId_status_idx" ON "User"("organizationId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "User_organizationId_emailNormalized_key" ON "User"("organizationId", "emailNormalized");

-- CreateIndex
CREATE UNIQUE INDEX "Role_organizationId_code_key" ON "Role"("organizationId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");

-- CreateIndex
CREATE INDEX "Session_userId_revokedAt_idx" ON "Session"("userId", "revokedAt");

-- CreateIndex
CREATE INDEX "Session_familyId_idx" ON "Session"("familyId");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_tokenHash_key" ON "VerificationToken"("tokenHash");

-- CreateIndex
CREATE INDEX "VerificationToken_userId_purpose_consumedAt_idx" ON "VerificationToken"("userId", "purpose", "consumedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Department_organizationId_code_key" ON "Department"("organizationId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "Department_organizationId_name_key" ON "Department"("organizationId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "WorkLocation_organizationId_name_key" ON "WorkLocation"("organizationId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Employee_userId_key" ON "Employee"("userId");

-- CreateIndex
CREATE INDEX "Employee_organizationId_employmentStatus_idx" ON "Employee"("organizationId", "employmentStatus");

-- CreateIndex
CREATE INDEX "Employee_organizationId_firstName_lastName_idx" ON "Employee"("organizationId", "firstName", "lastName");

-- CreateIndex
CREATE UNIQUE INDEX "Employee_organizationId_loginId_key" ON "Employee"("organizationId", "loginId");

-- CreateIndex
CREATE UNIQUE INDEX "Employee_organizationId_employeeCode_key" ON "Employee"("organizationId", "employeeCode");

-- CreateIndex
CREATE INDEX "EmploymentAssignment_organizationId_employeeId_effectiveFro_idx" ON "EmploymentAssignment"("organizationId", "employeeId", "effectiveFrom");

-- CreateIndex
CREATE INDEX "EmploymentAssignment_organizationId_managerId_idx" ON "EmploymentAssignment"("organizationId", "managerId");

-- CreateIndex
CREATE INDEX "EmployeePrivateProfile_organizationId_idx" ON "EmployeePrivateProfile"("organizationId");

-- CreateIndex
CREATE INDEX "EmployeeBankDetail_organizationId_idx" ON "EmployeeBankDetail"("organizationId");

-- CreateIndex
CREATE INDEX "EmployeeStatutoryDetail_organizationId_idx" ON "EmployeeStatutoryDetail"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "Skill_organizationId_normalizedName_key" ON "Skill"("organizationId", "normalizedName");

-- CreateIndex
CREATE UNIQUE INDEX "Certification_fileId_key" ON "Certification"("fileId");

-- CreateIndex
CREATE INDEX "Certification_organizationId_employeeId_idx" ON "Certification"("organizationId", "employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "FileObject_objectKey_key" ON "FileObject"("objectKey");

-- CreateIndex
CREATE INDEX "FileObject_organizationId_employeeId_idx" ON "FileObject"("organizationId", "employeeId");

-- CreateIndex
CREATE INDEX "FileObject_organizationId_scanStatus_idx" ON "FileObject"("organizationId", "scanStatus");

-- CreateIndex
CREATE INDEX "AuditEvent_organizationId_occurredAt_idx" ON "AuditEvent"("organizationId", "occurredAt");

-- CreateIndex
CREATE INDEX "AuditEvent_organizationId_resourceType_resourceId_idx" ON "AuditEvent"("organizationId", "resourceType", "resourceId");

-- CreateIndex
CREATE INDEX "OutboxEvent_status_availableAt_idx" ON "OutboxEvent"("status", "availableAt");

-- CreateIndex
CREATE INDEX "OutboxEvent_organizationId_createdAt_idx" ON "OutboxEvent"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "IdempotencyRecord_expiresAt_idx" ON "IdempotencyRecord"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "IdempotencyRecord_organizationId_userId_scope_key_key" ON "IdempotencyRecord"("organizationId", "userId", "scope", "key");

-- AddForeignKey
ALTER TABLE "OrganizationSequence" ADD CONSTRAINT "OrganizationSequence_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Role" ADD CONSTRAINT "Role_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerificationToken" ADD CONSTRAINT "VerificationToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Department" ADD CONSTRAINT "Department_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkLocation" ADD CONSTRAINT "WorkLocation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmploymentAssignment" ADD CONSTRAINT "EmploymentAssignment_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmploymentAssignment" ADD CONSTRAINT "EmploymentAssignment_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmploymentAssignment" ADD CONSTRAINT "EmploymentAssignment_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmploymentAssignment" ADD CONSTRAINT "EmploymentAssignment_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "WorkLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeePrivateProfile" ADD CONSTRAINT "EmployeePrivateProfile_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeBankDetail" ADD CONSTRAINT "EmployeeBankDetail_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeStatutoryDetail" ADD CONSTRAINT "EmployeeStatutoryDetail_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeResume" ADD CONSTRAINT "EmployeeResume_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Skill" ADD CONSTRAINT "Skill_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeSkill" ADD CONSTRAINT "EmployeeSkill_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeSkill" ADD CONSTRAINT "EmployeeSkill_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "Skill"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Certification" ADD CONSTRAINT "Certification_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Certification" ADD CONSTRAINT "Certification_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "FileObject"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FileObject" ADD CONSTRAINT "FileObject_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FileObject" ADD CONSTRAINT "FileObject_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutboxEvent" ADD CONSTRAINT "OutboxEvent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdempotencyRecord" ADD CONSTRAINT "IdempotencyRecord_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdempotencyRecord" ADD CONSTRAINT "IdempotencyRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
