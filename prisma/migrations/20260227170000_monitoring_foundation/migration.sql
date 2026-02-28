-- CreateEnum
CREATE TYPE "MonitorMethod" AS ENUM ('GET', 'HEAD', 'POST');
CREATE TYPE "ExpectedStatusMode" AS ENUM ('RANGE_2XX', 'EXACT_SET');
CREATE TYPE "BodyMatchType" AS ENUM ('NONE', 'CONTAINS', 'REGEX');
CREATE TYPE "MonitorCurrentStatus" AS ENUM ('UP', 'DOWN', 'DEGRADED');
CREATE TYPE "ProbeJobStatus" AS ENUM ('PENDING', 'RUNNING', 'DONE', 'FAILED');
CREATE TYPE "ProbeFailureReason" AS ENUM ('NONE', 'NETWORK', 'TIMEOUT', 'BAD_STATUS', 'BODY_MISMATCH', 'TLS_EXPIRY');
CREATE TYPE "ProbeExecutorType" AS ENUM ('BLACKBOX', 'NATIVE');
CREATE TYPE "AlertRuleType" AS ENUM ('DOWN', 'LATENCY', 'TLS_EXPIRY', 'BODY_MISMATCH');
CREATE TYPE "IncidentStatus" AS ENUM ('OPEN', 'RESOLVED');
CREATE TYPE "IncidentSeverity" AS ENUM ('CRITICAL', 'WARNING');
CREATE TYPE "NotificationChannelType" AS ENUM ('EMAIL', 'SLACK_WEBHOOK', 'GENERIC_WEBHOOK');
CREATE TYPE "NotificationEventType" AS ENUM ('OPENED', 'RESOLVED');
CREATE TYPE "NotificationEventStatus" AS ENUM ('PENDING', 'SENT', 'FAILED');

-- CreateTable
CREATE TABLE "Monitor" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "method" "MonitorMethod" NOT NULL DEFAULT 'GET',
  "intervalSec" INTEGER NOT NULL DEFAULT 60,
  "timeoutMs" INTEGER NOT NULL DEFAULT 10000,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "expectedStatusMode" "ExpectedStatusMode" NOT NULL DEFAULT 'RANGE_2XX',
  "expectedStatusCodes" JSONB,
  "bodyMatchType" "BodyMatchType" NOT NULL DEFAULT 'NONE',
  "bodyMatchPattern" TEXT,
  "latencyWarnMs" INTEGER,
  "tlsExpiryWarnDays" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Monitor_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProbeJob" (
  "id" TEXT NOT NULL,
  "monitorId" TEXT NOT NULL,
  "region" TEXT NOT NULL,
  "slotKey" TIMESTAMP(3) NOT NULL,
  "scheduledFor" TIMESTAMP(3) NOT NULL,
  "status" "ProbeJobStatus" NOT NULL DEFAULT 'PENDING',
  "lockedAt" TIMESTAMP(3),
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "errorMessage" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProbeJob_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProbeRun" (
  "id" TEXT NOT NULL,
  "monitorId" TEXT NOT NULL,
  "region" TEXT NOT NULL,
  "executorType" "ProbeExecutorType" NOT NULL DEFAULT 'BLACKBOX',
  "startedAt" TIMESTAMP(3) NOT NULL,
  "finishedAt" TIMESTAMP(3) NOT NULL,
  "ok" BOOLEAN NOT NULL,
  "failureReason" "ProbeFailureReason" NOT NULL DEFAULT 'NONE',
  "statusCode" INTEGER,
  "latencyMs" INTEGER,
  "dnsMs" INTEGER,
  "connectMs" INTEGER,
  "ttfbMs" INTEGER,
  "tlsDaysRemaining" INTEGER,
  "responseHeaders" JSONB,
  "responseSnippet" TEXT,
  "errorMessage" TEXT,
  "rawResult" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProbeRun_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MonitorState" (
  "id" TEXT NOT NULL,
  "monitorId" TEXT NOT NULL,
  "currentStatus" "MonitorCurrentStatus" NOT NULL DEFAULT 'UP',
  "consecutiveFailures" INTEGER NOT NULL DEFAULT 0,
  "consecutiveSuccesses" INTEGER NOT NULL DEFAULT 0,
  "lastSuccessAt" TIMESTAMP(3),
  "lastFailureAt" TIMESTAMP(3),
  "lastProbeRunId" TEXT,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MonitorState_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AlertRule" (
  "id" TEXT NOT NULL,
  "monitorId" TEXT NOT NULL,
  "ruleType" "AlertRuleType" NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "thresholdInt" INTEGER,
  "thresholdText" TEXT,
  "severity" "IncidentSeverity" NOT NULL DEFAULT 'CRITICAL',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AlertRule_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Incident" (
  "id" TEXT NOT NULL,
  "monitorId" TEXT NOT NULL,
  "status" "IncidentStatus" NOT NULL DEFAULT 'OPEN',
  "severity" "IncidentSeverity" NOT NULL DEFAULT 'CRITICAL',
  "openReason" TEXT NOT NULL,
  "resolveReason" TEXT,
  "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Incident_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "NotificationChannel" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "type" "NotificationChannelType" NOT NULL,
  "name" TEXT NOT NULL,
  "configEncrypted" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "NotificationChannel_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AlertSubscription" (
  "id" TEXT NOT NULL,
  "alertRuleId" TEXT NOT NULL,
  "channelId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AlertSubscription_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "NotificationEvent" (
  "id" TEXT NOT NULL,
  "incidentId" TEXT NOT NULL,
  "channelId" TEXT NOT NULL,
  "eventType" "NotificationEventType" NOT NULL,
  "status" "NotificationEventStatus" NOT NULL DEFAULT 'PENDING',
  "attemptCount" INTEGER NOT NULL DEFAULT 0,
  "lastError" TEXT,
  "nextAttemptAt" TIMESTAMP(3),
  "sentAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "NotificationEvent_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE INDEX "Monitor_orgId_createdAt_idx" ON "Monitor"("orgId", "createdAt" DESC);
CREATE INDEX "Monitor_orgId_isActive_idx" ON "Monitor"("orgId", "isActive");
CREATE UNIQUE INDEX "ProbeJob_monitorId_slotKey_key" ON "ProbeJob"("monitorId", "slotKey");
CREATE INDEX "ProbeJob_status_scheduledFor_idx" ON "ProbeJob"("status", "scheduledFor");
CREATE INDEX "ProbeJob_monitorId_scheduledFor_idx" ON "ProbeJob"("monitorId", "scheduledFor" DESC);
CREATE INDEX "ProbeRun_monitorId_startedAt_idx" ON "ProbeRun"("monitorId", "startedAt" DESC);
CREATE INDEX "ProbeRun_ok_startedAt_idx" ON "ProbeRun"("ok", "startedAt" DESC);
CREATE UNIQUE INDEX "MonitorState_monitorId_key" ON "MonitorState"("monitorId");
CREATE INDEX "MonitorState_currentStatus_idx" ON "MonitorState"("currentStatus");
CREATE INDEX "AlertRule_monitorId_enabled_idx" ON "AlertRule"("monitorId", "enabled");
CREATE INDEX "Incident_monitorId_status_openedAt_idx" ON "Incident"("monitorId", "status", "openedAt" DESC);
CREATE INDEX "NotificationChannel_orgId_enabled_idx" ON "NotificationChannel"("orgId", "enabled");
CREATE UNIQUE INDEX "AlertSubscription_alertRuleId_channelId_key" ON "AlertSubscription"("alertRuleId", "channelId");
CREATE INDEX "AlertSubscription_channelId_idx" ON "AlertSubscription"("channelId");
CREATE INDEX "NotificationEvent_status_createdAt_idx" ON "NotificationEvent"("status", "createdAt");
CREATE INDEX "NotificationEvent_incidentId_createdAt_idx" ON "NotificationEvent"("incidentId", "createdAt" DESC);

-- Foreign keys
ALTER TABLE "Monitor" ADD CONSTRAINT "Monitor_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProbeJob" ADD CONSTRAINT "ProbeJob_monitorId_fkey" FOREIGN KEY ("monitorId") REFERENCES "Monitor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProbeRun" ADD CONSTRAINT "ProbeRun_monitorId_fkey" FOREIGN KEY ("monitorId") REFERENCES "Monitor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MonitorState" ADD CONSTRAINT "MonitorState_monitorId_fkey" FOREIGN KEY ("monitorId") REFERENCES "Monitor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AlertRule" ADD CONSTRAINT "AlertRule_monitorId_fkey" FOREIGN KEY ("monitorId") REFERENCES "Monitor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_monitorId_fkey" FOREIGN KEY ("monitorId") REFERENCES "Monitor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "NotificationChannel" ADD CONSTRAINT "NotificationChannel_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AlertSubscription" ADD CONSTRAINT "AlertSubscription_alertRuleId_fkey" FOREIGN KEY ("alertRuleId") REFERENCES "AlertRule"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AlertSubscription" ADD CONSTRAINT "AlertSubscription_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "NotificationChannel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "NotificationEvent" ADD CONSTRAINT "NotificationEvent_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "Incident"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "NotificationEvent" ADD CONSTRAINT "NotificationEvent_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "NotificationChannel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
