import { MAX_QUEUED_JOBS_PER_ORG, SCHEDULER_TICK_MS } from "~/lib/constants";
import { prisma } from "~/lib/db.server";
import { listActiveMonitors } from "~/models/monitoring/monitor.server";
import { enqueueProbeJobs } from "~/models/monitoring/probe-job.server";

const SCHEDULER_LOCK_ID = 8712345;

async function tryAcquireLock() {
  const rows = await prisma.$queryRaw<Array<{ locked: boolean }>>`SELECT pg_try_advisory_lock(${SCHEDULER_LOCK_ID}) as locked`;
  return rows[0]?.locked === true;
}

async function releaseLock() {
  await prisma.$queryRaw`SELECT pg_advisory_unlock(${SCHEDULER_LOCK_ID})`;
}

async function getDatabaseNow() {
  const rows = await prisma.$queryRaw<Array<{ now: Date }>>`SELECT NOW() AS now`;
  return rows[0]?.now ?? new Date();
}

export async function runSchedulerTick(now?: Date) {
  const locked = await tryAcquireLock();
  if (!locked) {
    return { enqueued: 0, skipped: true };
  }

  try {
    const tickNow = now ?? (await getDatabaseNow());
    const monitors = await listActiveMonitors();
    const queueCounts = await prisma.$queryRaw<Array<{ orgId: string; count: bigint }>>`
      SELECT m."orgId", COUNT(*)::bigint AS count
      FROM "ProbeJob" j
      JOIN "Monitor" m ON m.id = j."monitorId"
      WHERE j.status IN ('PENDING'::"ProbeJobStatus", 'RUNNING'::"ProbeJobStatus")
      GROUP BY m."orgId"
    `;
    const queuedByOrg = new Map(queueCounts.map((row) => [row.orgId, Number(row.count)]));

    const entries: Array<{ monitorId: string; slotKey: Date; scheduledFor: Date; region: string }> = [];

    for (const monitor of monitors) {
      const currentQueued = queuedByOrg.get(monitor.orgId) ?? 0;
      if (currentQueued >= MAX_QUEUED_JOBS_PER_ORG) {
        continue;
      }

      const intervalMs = Math.max(1, monitor.intervalSec) * 1000;
      const slotTime = Math.floor(tickNow.getTime() / intervalMs) * intervalMs;
      const slotKey = new Date(slotTime);

      entries.push({
        monitorId: monitor.id,
        slotKey,
        scheduledFor: slotKey,
        region: "us-east-1",
      });
      queuedByOrg.set(monitor.orgId, currentQueued + 1);
    }

    const result = await enqueueProbeJobs(entries);
    return { enqueued: result.count, skipped: false, tickMs: SCHEDULER_TICK_MS };
  } finally {
    await releaseLock();
  }
}
