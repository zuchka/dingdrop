import { Prisma, type ProbeJob } from "@prisma/client";
import { prisma } from "~/lib/db.server";

export async function enqueueProbeJobs(entries: Array<{ monitorId: string; slotKey: Date; scheduledFor: Date; region: string }>) {
  if (entries.length === 0) return { count: 0 };

  return prisma.probeJob.createMany({
    data: entries,
    skipDuplicates: true,
  });
}

export async function claimDueProbeJobs(limit: number): Promise<ProbeJob[]> {
  const safeLimit = Number.isFinite(limit) ? Math.max(1, Math.min(limit, 100)) : 10;
  return prisma.$queryRaw<ProbeJob[]>(Prisma.sql`
    WITH picked AS (
      SELECT id
      FROM "ProbeJob"
      WHERE status = 'PENDING'::"ProbeJobStatus"
        AND "scheduledFor" <= NOW()
      ORDER BY "scheduledFor" ASC
      LIMIT ${safeLimit}
      FOR UPDATE SKIP LOCKED
    )
    UPDATE "ProbeJob" j
    SET status = 'RUNNING'::"ProbeJobStatus",
        "lockedAt" = NOW(),
        attempts = attempts + 1,
        "updatedAt" = NOW()
    FROM picked
    WHERE j.id = picked.id
    RETURNING j.*
  `);
}

export function markProbeJobDone(jobId: string) {
  return prisma.probeJob.update({
    where: { id: jobId },
    data: {
      status: "DONE",
      updatedAt: new Date(),
      errorMessage: null,
    },
  });
}

export function markProbeJobFailed(jobId: string, errorMessage: string) {
  return prisma.probeJob.update({
    where: { id: jobId },
    data: {
      status: "FAILED",
      updatedAt: new Date(),
      errorMessage,
    },
  });
}

export function getProbeQueueDepth() {
  return prisma.probeJob.groupBy({
    by: ["status"],
    _count: { _all: true },
  });
}
