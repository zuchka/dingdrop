-- Normalize remaining core tables to timestamptz and harden notification processing.
-- Existing timestamp values were written as UTC wall-clock, so reinterpret as UTC.

ALTER TABLE "User"
  ALTER COLUMN "createdAt" TYPE TIMESTAMPTZ(3) USING "createdAt" AT TIME ZONE 'UTC',
  ALTER COLUMN "updatedAt" TYPE TIMESTAMPTZ(3) USING "updatedAt" AT TIME ZONE 'UTC';

ALTER TABLE "Org"
  ALTER COLUMN "createdAt" TYPE TIMESTAMPTZ(3) USING "createdAt" AT TIME ZONE 'UTC',
  ALTER COLUMN "updatedAt" TYPE TIMESTAMPTZ(3) USING "updatedAt" AT TIME ZONE 'UTC';

ALTER TABLE "OrgMember"
  ALTER COLUMN "createdAt" TYPE TIMESTAMPTZ(3) USING "createdAt" AT TIME ZONE 'UTC';

ALTER TABLE "Endpoint"
  ALTER COLUMN "createdAt" TYPE TIMESTAMPTZ(3) USING "createdAt" AT TIME ZONE 'UTC',
  ALTER COLUMN "updatedAt" TYPE TIMESTAMPTZ(3) USING "updatedAt" AT TIME ZONE 'UTC';

ALTER TABLE "WebhookRequest"
  ALTER COLUMN "receivedAt" TYPE TIMESTAMPTZ(3) USING "receivedAt" AT TIME ZONE 'UTC';

ALTER TABLE "ReplayAttempt"
  ALTER COLUMN "createdAt" TYPE TIMESTAMPTZ(3) USING "createdAt" AT TIME ZONE 'UTC';

ALTER TYPE "NotificationEventStatus" ADD VALUE IF NOT EXISTS 'PROCESSING';

ALTER TABLE "NotificationEvent"
  ADD COLUMN "processingToken" TEXT,
  ADD COLUMN "processingStartedAt" TIMESTAMPTZ(3);

CREATE UNIQUE INDEX IF NOT EXISTS "NotificationEvent_incidentId_channelId_eventType_key"
  ON "NotificationEvent"("incidentId", "channelId", "eventType");

CREATE INDEX IF NOT EXISTS "NotificationEvent_status_nextAttemptAt_createdAt_idx"
  ON "NotificationEvent"("status", "nextAttemptAt", "createdAt");

CREATE INDEX IF NOT EXISTS "NotificationEvent_processingStartedAt_idx"
  ON "NotificationEvent"("processingStartedAt");
