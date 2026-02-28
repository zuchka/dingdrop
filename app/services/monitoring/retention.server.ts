import { NOTIFICATION_EVENT_RETENTION_DAYS, PROBE_RUN_RETENTION_DAYS } from "~/lib/constants";
import { prisma } from "~/lib/db.server";

export async function runMonitoringRetentionPass() {
  const probeCutoff = new Date(Date.now() - PROBE_RUN_RETENTION_DAYS * 24 * 60 * 60 * 1000);
  const eventCutoff = new Date(Date.now() - NOTIFICATION_EVENT_RETENTION_DAYS * 24 * 60 * 60 * 1000);
  const jobCutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [probeRuns, notificationEvents, oldJobs] = await Promise.all([
    prisma.probeRun.deleteMany({ where: { createdAt: { lt: probeCutoff } } }),
    prisma.notificationEvent.deleteMany({ where: { createdAt: { lt: eventCutoff } } }),
    prisma.probeJob.deleteMany({
      where: {
        createdAt: { lt: jobCutoff },
        status: { in: ["DONE", "FAILED"] },
      },
    }),
  ]);

  return {
    probeRunsDeleted: probeRuns.count,
    notificationEventsDeleted: notificationEvents.count,
    probeJobsDeleted: oldJobs.count,
  };
}
