import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { ALERT_COOLDOWN_MINUTES } from "~/lib/constants";
import { prisma } from "~/lib/db.server";

type ClaimedNotificationEvent = Prisma.NotificationEventGetPayload<{
  include: {
    channel: true;
    incident: { include: { monitor: true } };
  };
}>;

export async function createNotificationEventsForIncident({
  incidentId,
  channelIds,
  eventType,
}: {
  incidentId: string;
  channelIds: string[];
  eventType: "OPENED" | "RESOLVED";
}) {
  if (channelIds.length === 0) return { count: 0 };

  const dedupedChannelIds = [...new Set(channelIds)];
  const data = dedupedChannelIds.map((channelId) => ({ incidentId, channelId, eventType }));

  if (data.length === 0) return { count: 0 };

  return prisma.notificationEvent.createMany({ data, skipDuplicates: true });
}

export async function claimPendingNotificationEvents(limit = 20): Promise<{ token: string; events: ClaimedNotificationEvent[] }> {
  const safeLimit = Number.isFinite(limit) ? Math.max(1, Math.min(limit, 200)) : 20;
  const token = randomUUID();
  const reclaimCutoffMs = Date.now() - ALERT_COOLDOWN_MINUTES * 60_000;

  const claimedIds = await prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    WITH picked AS (
      SELECT id
      FROM "NotificationEvent"
      WHERE (
          status = 'PENDING'::"NotificationEventStatus"
          AND ("nextAttemptAt" IS NULL OR "nextAttemptAt" <= NOW())
        ) OR (
          status = 'PROCESSING'::"NotificationEventStatus"
          AND "processingStartedAt" IS NOT NULL
          AND "processingStartedAt" <= ${new Date(reclaimCutoffMs)}
        )
      ORDER BY "createdAt" ASC
      LIMIT ${safeLimit}
      FOR UPDATE SKIP LOCKED
    )
    UPDATE "NotificationEvent" n
    SET status = 'PROCESSING'::"NotificationEventStatus",
        "processingToken" = ${token},
        "processingStartedAt" = NOW(),
        "updatedAt" = NOW()
    FROM picked
    WHERE n.id = picked.id
    RETURNING n.id
  `);

  if (claimedIds.length === 0) {
    return { token, events: [] };
  }

  const ids = claimedIds.map((row) => row.id);
  const events = await prisma.notificationEvent.findMany({
    where: { id: { in: ids }, processingToken: token },
    include: {
      channel: true,
      incident: { include: { monitor: true } },
    },
    orderBy: { createdAt: "asc" },
  });
  return { token, events };
}

export async function markNotificationSent(id: string, processingToken: string) {
  const result = await prisma.notificationEvent.updateMany({
    where: { id, status: "PROCESSING", processingToken },
    data: {
      status: "SENT",
      sentAt: new Date(),
      updatedAt: new Date(),
      processingToken: null,
      processingStartedAt: null,
    },
  });
  return result.count > 0;
}

export async function markNotificationFailed(id: string, processingToken: string, lastError: string, attemptCount: number) {
  const maxAttempts = 5;
  const failed = attemptCount + 1 >= maxAttempts;
  const nextAttemptAt = failed ? null : new Date(Date.now() + Math.pow(2, attemptCount) * 60_000);

  const result = await prisma.notificationEvent.updateMany({
    where: { id, status: "PROCESSING", processingToken },
    data: {
      status: failed ? "FAILED" : "PENDING",
      lastError,
      attemptCount: { increment: 1 },
      nextAttemptAt,
      updatedAt: new Date(),
      processingToken: null,
      processingStartedAt: null,
    },
  });
  return result.count > 0;
}
