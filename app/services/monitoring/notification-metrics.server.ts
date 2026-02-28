import { prisma } from "~/lib/db.server";
import type { NotificationChannelType, NotificationEventStatus } from "@prisma/client";

/**
 * Aggregated metrics for notification system health
 */
export interface NotificationMetrics {
  totalPending: number;
  totalProcessing: number;
  totalStuck: number;
  successRate: {
    overall: number;
    byChannelType: Record<NotificationChannelType, {
      sent: number;
      failed: number;
      rate: number;
    }>;
  };
  averageDeliveryTimeMs: number;
  recentFailures: Array<{
    channelType: NotificationChannelType;
    error: string | null;
    occurredAt: Date;
  }>;
}

/**
 * Get current notification queue depth and health metrics
 */
export async function getNotificationMetrics(orgId?: string): Promise<NotificationMetrics> {
  const where = orgId ? { channel: { orgId } } : {};
  const since = new Date(Date.now() - 3600_000); // Last hour

  // Queue depths
  const [totalPending, totalProcessing, totalStuck] = await Promise.all([
    prisma.notificationEvent.count({
      where: { ...where, status: "PENDING" },
    }),
    prisma.notificationEvent.count({
      where: { ...where, status: "PROCESSING" },
    }),
    prisma.notificationEvent.count({
      where: {
        ...where,
        status: "PROCESSING",
        claimedAt: { lt: new Date(Date.now() - 300_000) }, // Stuck > 5 minutes
      },
    }),
  ]);

  // Success/failure counts by channel type
  const recentEvents = await prisma.notificationEvent.findMany({
    where: {
      ...where,
      createdAt: { gte: since },
      status: { in: ["SENT", "FAILED"] },
    },
    select: {
      status: true,
      channel: { select: { type: true } },
      sentAt: true,
      createdAt: true,
      lastError: true,
    },
  });

  // Calculate success rates by channel type
  const byChannelType: Record<string, { sent: number; failed: number; rate: number }> = {};
  const channelTypes: NotificationChannelType[] = ["EMAIL", "SLACK_WEBHOOK", "GENERIC_WEBHOOK"];
  
  for (const type of channelTypes) {
    const typeEvents = recentEvents.filter(e => e.channel.type === type);
    const sent = typeEvents.filter(e => e.status === "SENT").length;
    const failed = typeEvents.filter(e => e.status === "FAILED").length;
    const total = sent + failed;
    const rate = total > 0 ? (sent / total) * 100 : 100;
    
    byChannelType[type] = { sent, failed, rate };
  }

  // Overall success rate
  const totalSent = recentEvents.filter(e => e.status === "SENT").length;
  const totalFailed = recentEvents.filter(e => e.status === "FAILED").length;
  const overallTotal = totalSent + totalFailed;
  const overallRate = overallTotal > 0 ? (totalSent / overallTotal) * 100 : 100;

  // Average delivery time
  const sentEvents = recentEvents.filter(e => e.status === "SENT" && e.sentAt);
  const totalDeliveryTime = sentEvents.reduce((sum, e) => {
    if (e.sentAt) {
      return sum + (e.sentAt.getTime() - e.createdAt.getTime());
    }
    return sum;
  }, 0);
  const averageDeliveryTimeMs = sentEvents.length > 0 ? totalDeliveryTime / sentEvents.length : 0;

  // Recent failures (last 10)
  const recentFailures = recentEvents
    .filter(e => e.status === "FAILED")
    .slice(0, 10)
    .map(e => ({
      channelType: e.channel.type,
      error: e.lastError,
      occurredAt: e.createdAt,
    }));

  return {
    totalPending,
    totalProcessing,
    totalStuck,
    successRate: {
      overall: overallRate,
      byChannelType: byChannelType as Record<NotificationChannelType, { sent: number; failed: number; rate: number }>,
    },
    averageDeliveryTimeMs,
    recentFailures,
  };
}

/**
 * Log notification metrics to console
 */
export function logNotificationMetrics(metrics: NotificationMetrics): void {
  console.log("=== Notification System Metrics ===");
  console.log(`Queue: ${metrics.totalPending} pending, ${metrics.totalProcessing} processing, ${metrics.totalStuck} stuck`);
  console.log(`Success rate (last hour): ${metrics.successRate.overall.toFixed(1)}%`);
  console.log(`Average delivery time: ${metrics.averageDeliveryTimeMs.toFixed(0)}ms`);
  
  console.log("By channel type:");
  for (const [type, stats] of Object.entries(metrics.successRate.byChannelType)) {
    if (stats.sent > 0 || stats.failed > 0) {
      console.log(`  ${type}: ${stats.sent} sent, ${stats.failed} failed (${stats.rate.toFixed(1)}%)`);
    }
  }
  
  if (metrics.recentFailures.length > 0) {
    console.log("Recent failures:");
    for (const failure of metrics.recentFailures.slice(0, 3)) {
      console.log(`  [${failure.channelType}] ${failure.error?.slice(0, 80) || 'Unknown error'}`);
    }
  }
  
  console.log("===================================");
}

/**
 * Get stuck notification events (processing > 5 minutes)
 */
export async function getStuckNotificationEvents(orgId?: string) {
  const where = orgId ? { channel: { orgId } } : {};
  
  return prisma.notificationEvent.findMany({
    where: {
      ...where,
      status: "PROCESSING",
      claimedAt: { lt: new Date(Date.now() - 300_000) },
    },
    include: {
      channel: { select: { id: true, type: true, name: true } },
      incident: { 
        select: { 
          id: true,
          monitor: { select: { name: true } },
        } 
      },
    },
    orderBy: { claimedAt: "asc" },
    take: 20,
  });
}
