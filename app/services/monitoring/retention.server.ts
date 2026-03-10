import { NOTIFICATION_EVENT_RETENTION_DAYS, PROBE_RUN_RETENTION_DAYS } from "~/lib/constants";
import { prisma } from "~/lib/db.server";

/**
 * Delete records in batches to avoid large transactions
 * This prevents WAL bloat, table locks, and memory issues
 */
async function deleteInBatches(
  tableName: string,
  cutoffDate: Date,
  batchSize = 10000,
  additionalWhere?: Record<string, unknown>
): Promise<number> {
  let totalDeleted = 0;
  
  while (true) {
    // Use raw query with LIMIT to delete in batches
    const whereClause = additionalWhere 
      ? `"createdAt" < $1 AND ${Object.entries(additionalWhere).map(([key, val]) => 
          Array.isArray(val) 
            ? `"${key}" IN (${(val as string[]).map(v => `'${v}'`).join(',')})`
            : `"${key}" = '${val}'`
        ).join(' AND ')}`
      : `"createdAt" < $1`;
    
    const deleted = await prisma.$executeRawUnsafe(
      `DELETE FROM "${tableName}" WHERE ctid IN (
        SELECT ctid FROM "${tableName}" 
        WHERE ${whereClause}
        LIMIT $2
      )`,
      cutoffDate,
      batchSize
    );
    
    totalDeleted += deleted;
    
    // If we deleted fewer rows than the batch size, we're done
    if (deleted < batchSize) {
      break;
    }
    
    // Brief pause between batches to reduce database load
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  return totalDeleted;
}

export async function runMonitoringRetentionPass() {
  const probeCutoff = new Date(Date.now() - PROBE_RUN_RETENTION_DAYS * 24 * 60 * 60 * 1000);
  const eventCutoff = new Date(Date.now() - NOTIFICATION_EVENT_RETENTION_DAYS * 24 * 60 * 60 * 1000);
  const jobCutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  console.log("[retention] Starting retention cleanup pass...");
  console.log(`[retention] ProbeRun cutoff: ${probeCutoff.toISOString()}`);
  console.log(`[retention] NotificationEvent cutoff: ${eventCutoff.toISOString()}`);
  console.log(`[retention] ProbeJob cutoff: ${jobCutoff.toISOString()}`);

  const startTime = Date.now();

  // Delete in batches to avoid large transactions
  const [probeRunsDeleted, notificationEventsDeleted, probeJobsDeleted] = await Promise.all([
    deleteInBatches("ProbeRun", probeCutoff),
    deleteInBatches("NotificationEvent", eventCutoff),
    deleteInBatches("ProbeJob", jobCutoff, 10000, { 
      status: ["DONE", "FAILED"] 
    }),
  ]);

  const duration = Date.now() - startTime;
  console.log(`[retention] Cleanup complete in ${duration}ms:`);
  console.log(`[retention]   - ProbeRuns: ${probeRunsDeleted}`);
  console.log(`[retention]   - NotificationEvents: ${notificationEventsDeleted}`);
  console.log(`[retention]   - ProbeJobs: ${probeJobsDeleted}`);

  return {
    probeRunsDeleted,
    notificationEventsDeleted,
    probeJobsDeleted,
    durationMs: duration,
  };
}
