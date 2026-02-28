import { prisma } from "~/lib/db.server";

/**
 * Get dashboard metrics for alerts
 */
export async function getAlertDashboardMetrics({
  orgId,
  timeRange = 7, // days
}: {
  orgId: string;
  timeRange?: number;
}) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - timeRange);

  // Active incidents count
  const activeIncidents = await prisma.incident.count({
    where: {
      monitor: { orgId },
      status: "OPEN",
    },
  });

  // Total incidents in time range
  const recentIncidents = await prisma.incident.findMany({
    where: {
      monitor: { orgId },
      openedAt: { gte: startDate },
    },
    orderBy: { openedAt: "desc" },
    include: {
      monitor: {
        select: { name: true },
      },
    },
  });

  // Count by severity
  const criticalIncidents = recentIncidents.filter((i) => i.severity === "CRITICAL").length;
  const warningIncidents = recentIncidents.filter((i) => i.severity === "WARNING").length;

  // Notification stats
  const notificationStats = await prisma.notificationEvent.groupBy({
    by: ["status"],
    where: {
      incident: {
        monitor: { orgId },
      },
      createdAt: { gte: startDate },
    },
    _count: true,
  });

  const totalNotifications = notificationStats.reduce((sum, stat) => sum + stat._count, 0);
  const sentNotifications = notificationStats.find((s) => s.status === "SENT")?._count || 0;
  const failedNotifications = notificationStats.find((s) => s.status === "FAILED")?._count || 0;
  const notificationSuccessRate =
    totalNotifications > 0 ? Math.round((sentNotifications / totalNotifications) * 100) : 0;

  // Top alerting monitors
  const monitorIncidentCounts = new Map<string, { name: string; count: number }>();
  recentIncidents.forEach((incident) => {
    const existing = monitorIncidentCounts.get(incident.monitorId);
    if (existing) {
      existing.count++;
    } else {
      monitorIncidentCounts.set(incident.monitorId, {
        name: incident.monitor.name,
        count: 1,
      });
    }
  });

  const topMonitors = Array.from(monitorIncidentCounts.entries())
    .map(([id, data]) => ({ monitorId: id, name: data.name, count: data.count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return {
    activeIncidents,
    totalRecentIncidents: recentIncidents.length,
    criticalIncidents,
    warningIncidents,
    notifications: {
      total: totalNotifications,
      sent: sentNotifications,
      failed: failedNotifications,
      successRate: notificationSuccessRate,
    },
    topMonitors,
    timeRange,
  };
}

/**
 * Get alert firing history for a specific rule
 */
export async function getAlertFiringHistory({
  alertRuleId,
  timeRange = 30, // days
}: {
  alertRuleId: string;
  timeRange?: number;
}) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - timeRange);

  const alertRule = await prisma.alertRule.findUnique({
    where: { id: alertRuleId },
    select: { monitorId: true },
  });

  if (!alertRule) {
    return { incidents: [], timeRange };
  }

  const incidents = await prisma.incident.findMany({
    where: {
      monitorId: alertRule.monitorId,
      openedAt: { gte: startDate },
    },
    orderBy: { openedAt: "asc" },
    select: {
      id: true,
      status: true,
      severity: true,
      openedAt: true,
      resolvedAt: true,
    },
  });

  // Group by day for trend chart
  const incidentsByDay = new Map<string, number>();
  incidents.forEach((incident) => {
    const day = new Date(incident.openedAt).toISOString().split("T")[0];
    incidentsByDay.set(day, (incidentsByDay.get(day) || 0) + 1);
  });

  const trendData = Array.from(incidentsByDay.entries()).map(([date, count]) => ({
    date,
    count,
  }));

  return {
    incidents,
    trendData,
    totalCount: incidents.length,
    timeRange,
  };
}

/**
 * Get notification health metrics
 */
export async function getNotificationHealthMetrics({
  orgId,
  timeRange = 7, // days
}: {
  orgId: string;
  timeRange?: number;
}) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - timeRange);

  // Get all notification events with channel info
  const events = await prisma.notificationEvent.findMany({
    where: {
      incident: {
        monitor: { orgId },
      },
      createdAt: { gte: startDate },
    },
    include: {
      channel: {
        select: {
          id: true,
          name: true,
          type: true,
        },
      },
    },
  });

  // Group by channel
  const channelStats = new Map<
    string,
    {
      channelId: string;
      name: string;
      type: string;
      total: number;
      sent: number;
      failed: number;
      pending: number;
    }
  >();

  events.forEach((event) => {
    const key = event.channelId;
    const existing = channelStats.get(key);

    if (existing) {
      existing.total++;
      if (event.status === "SENT") existing.sent++;
      if (event.status === "FAILED") existing.failed++;
      if (event.status === "PENDING" || event.status === "PROCESSING") existing.pending++;
    } else {
      channelStats.set(key, {
        channelId: event.channel.id,
        name: event.channel.name,
        type: event.channel.type,
        total: 1,
        sent: event.status === "SENT" ? 1 : 0,
        failed: event.status === "FAILED" ? 1 : 0,
        pending: event.status === "PENDING" || event.status === "PROCESSING" ? 1 : 0,
      });
    }
  });

  const channelMetrics = Array.from(channelStats.values()).map((stats) => ({
    ...stats,
    successRate: stats.total > 0 ? Math.round((stats.sent / stats.total) * 100) : 0,
  }));

  return {
    channelMetrics,
    timeRange,
  };
}

/**
 * Get incident trend data for dashboard charts
 */
export async function getIncidentTrendData({
  orgId,
  timeRange = 30, // days
}: {
  orgId: string;
  timeRange?: number;
}) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - timeRange);

  const incidents = await prisma.incident.findMany({
    where: {
      monitor: { orgId },
      openedAt: { gte: startDate },
    },
    orderBy: { openedAt: "asc" },
    select: {
      openedAt: true,
      severity: true,
      status: true,
    },
  });

  // Group by day
  const trendByDay = new Map<
    string,
    { date: string; critical: number; warning: number; total: number }
  >();

  incidents.forEach((incident) => {
    const day = new Date(incident.openedAt).toISOString().split("T")[0];
    const existing = trendByDay.get(day);

    if (existing) {
      existing.total++;
      if (incident.severity === "CRITICAL") existing.critical++;
      if (incident.severity === "WARNING") existing.warning++;
    } else {
      trendByDay.set(day, {
        date: day,
        critical: incident.severity === "CRITICAL" ? 1 : 0,
        warning: incident.severity === "WARNING" ? 1 : 0,
        total: 1,
      });
    }
  });

  const trendData = Array.from(trendByDay.values()).sort((a, b) =>
    a.date.localeCompare(b.date)
  );

  return {
    trendData,
    timeRange,
  };
}
