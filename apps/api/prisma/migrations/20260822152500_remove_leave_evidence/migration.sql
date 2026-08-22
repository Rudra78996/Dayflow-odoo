ALTER TABLE "LeaveRequest"
  DROP CONSTRAINT IF EXISTS "LeaveRequest_evidenceFileId_fkey";

DROP INDEX IF EXISTS "LeaveRequest_evidenceFileId_key";

ALTER TABLE "LeaveRequest"
  DROP COLUMN IF EXISTS "evidenceFileId";

ALTER TABLE "LeaveType"
  DROP COLUMN IF EXISTS "attachmentAfterUnits";
