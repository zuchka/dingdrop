-- AlterTable: Add performance indexes for ProbeRun and ProbeJob tables

-- Add index on ProbeRun.createdAt for efficient retention cleanup
CREATE INDEX IF NOT EXISTS "idx_probe_run_created_at" ON "ProbeRun"("createdAt");

-- Add composite index on ProbeJob for scheduler queue queries
-- This optimizes queries that filter by status and group by monitorId
CREATE INDEX IF NOT EXISTS "idx_probe_job_status_monitor" ON "ProbeJob"("status", "monitorId");
