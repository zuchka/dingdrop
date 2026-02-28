import type { AlertRuleType, IncidentSeverity, IncidentStatus } from "@prisma/client";
import { prisma } from "~/lib/db.server";

export function getEnabledAlertRulesForMonitor(monitorId: string) {
  return prisma.alertRule.findMany({
    where: { monitorId, enabled: true },
    include: {
      subscriptions: {
        include: { channel: true },
      },
    },
  });
}

export function listAlertRulesForMonitor(monitorId: string) {
  return prisma.alertRule.findMany({
    where: { monitorId },
    include: {
      subscriptions: {
        include: { channel: true },
      },
    },
    orderBy: { createdAt: "asc" },
  });
}

export function listAlertRulesForOrg(orgId: string) {
  return prisma.alertRule.findMany({
    where: { monitor: { orgId } },
    include: {
      monitor: { select: { id: true, name: true } },
      subscriptions: {
        include: { channel: true },
      },
    },
    orderBy: [{ monitor: { name: "asc" } }, { createdAt: "asc" }],
  });
}

export function updateAlertRule({
  monitorId,
  ruleId,
  enabled,
}: {
  monitorId: string;
  ruleId: string;
  enabled: boolean;
}) {
  return prisma.alertRule.updateMany({
    where: { id: ruleId, monitorId },
    data: { enabled },
  });
}

export async function replaceAlertRuleSubscriptions({
  ruleId,
  channelIds,
}: {
  ruleId: string;
  channelIds: string[];
}) {
  return prisma.$transaction(async (tx) => {
    await tx.alertSubscription.deleteMany({ where: { alertRuleId: ruleId } });

    if (channelIds.length > 0) {
      await tx.alertSubscription.createMany({
        data: channelIds.map((channelId) => ({ alertRuleId: ruleId, channelId })),
        skipDuplicates: true,
      });
    }
  });
}

/**
 * Create a new alert rule with channel subscriptions
 */
export async function createAlertRule({
  monitorId,
  orgId,
  ruleType,
  severity,
  thresholdInt,
  thresholdText,
  channelIds = [],
}: {
  monitorId: string;
  orgId: string;
  ruleType: AlertRuleType;
  severity: IncidentSeverity;
  thresholdInt?: number | null;
  thresholdText?: string | null;
  channelIds?: string[];
}) {
  // Verify monitor belongs to org
  const monitor = await prisma.monitor.findFirst({
    where: { id: monitorId, orgId },
  });

  if (!monitor) {
    throw new Error("Monitor not found or does not belong to organization");
  }

  return prisma.alertRule.create({
    data: {
      monitorId,
      ruleType,
      severity,
      thresholdInt,
      thresholdText,
      enabled: true,
      subscriptions: {
        create: channelIds.map((channelId) => ({ channelId })),
      },
    },
    include: {
      subscriptions: {
        include: { channel: true },
      },
      monitor: {
        select: { id: true, name: true },
      },
    },
  });
}

/**
 * Update alert rule configuration
 */
export async function updateAlertRuleConfig({
  ruleId,
  orgId,
  ruleType,
  severity,
  thresholdInt,
  thresholdText,
  enabled,
}: {
  ruleId: string;
  orgId: string;
  ruleType?: AlertRuleType;
  severity?: IncidentSeverity;
  thresholdInt?: number | null;
  thresholdText?: string | null;
  enabled?: boolean;
}) {
  // Verify rule belongs to org
  const rule = await prisma.alertRule.findFirst({
    where: { id: ruleId, monitor: { orgId } },
  });

  if (!rule) {
    throw new Error("Alert rule not found or does not belong to organization");
  }

  return prisma.alertRule.update({
    where: { id: ruleId },
    data: {
      ruleType,
      severity,
      thresholdInt,
      thresholdText,
      enabled,
    },
    include: {
      subscriptions: {
        include: { channel: true },
      },
      monitor: {
        select: { id: true, name: true },
      },
    },
  });
}

/**
 * Delete an alert rule (and cascade subscriptions)
 */
export async function deleteAlertRule({
  ruleId,
  orgId,
}: {
  ruleId: string;
  orgId: string;
}) {
  // Verify rule belongs to org
  const rule = await prisma.alertRule.findFirst({
    where: { id: ruleId, monitor: { orgId } },
  });

  if (!rule) {
    throw new Error("Alert rule not found or does not belong to organization");
  }

  return prisma.alertRule.delete({
    where: { id: ruleId },
  });
}

/**
 * Get alert rule with stats (incident count, last fired)
 */
export async function getAlertRuleWithStats({
  ruleId,
  orgId,
}: {
  ruleId: string;
  orgId: string;
}) {
  const rule = await prisma.alertRule.findFirst({
    where: { id: ruleId, monitor: { orgId } },
    include: {
      monitor: {
        select: { id: true, name: true, url: true, orgId: true },
      },
      subscriptions: {
        include: { channel: true },
      },
    },
  });

  if (!rule) {
    return null;
  }

  // Get incident stats
  const incidents = await prisma.incident.findMany({
    where: { monitorId: rule.monitorId },
    orderBy: { openedAt: "desc" },
    select: {
      id: true,
      status: true,
      severity: true,
      openedAt: true,
      resolvedAt: true,
    },
  });

  const incidentCount = incidents.length;
  const openIncidentCount = incidents.filter((i) => i.status === "OPEN").length;
  const lastFired = incidents[0]?.openedAt ?? null;

  return {
    ...rule,
    stats: {
      incidentCount,
      openIncidentCount,
      lastFired,
    },
    incidents: incidents.slice(0, 10), // Recent 10 incidents
  };
}

/**
 * Get alert rules with pagination and filtering
 */
export async function getAlertRulesWithPagination({
  orgId,
  page = 1,
  pageSize = 20,
  filters = {},
}: {
  orgId: string;
  page?: number;
  pageSize?: number;
  filters?: {
    ruleType?: AlertRuleType;
    severity?: IncidentSeverity;
    enabled?: boolean;
    monitorId?: string;
    search?: string;
  };
}) {
  const where: any = {
    monitor: { orgId },
  };

  if (filters.ruleType) {
    where.ruleType = filters.ruleType;
  }

  if (filters.severity) {
    where.severity = filters.severity;
  }

  if (filters.enabled !== undefined) {
    where.enabled = filters.enabled;
  }

  if (filters.monitorId) {
    where.monitorId = filters.monitorId;
  }

  if (filters.search) {
    where.monitor = {
      ...where.monitor,
      name: { contains: filters.search, mode: "insensitive" },
    };
  }

  const [rules, totalCount] = await Promise.all([
    prisma.alertRule.findMany({
      where,
      include: {
        monitor: { select: { id: true, name: true } },
        subscriptions: {
          include: { channel: { select: { id: true, name: true, type: true } } },
        },
      },
      orderBy: [{ monitor: { name: "asc" } }, { createdAt: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.alertRule.count({ where }),
  ]);

  return {
    rules,
    totalCount,
    page,
    pageSize,
    totalPages: Math.ceil(totalCount / pageSize),
  };
}

/**
 * Get alert rule for org (simple verification helper)
 */
export async function getAlertRuleForOrg({
  ruleId,
  orgId,
}: {
  ruleId: string;
  orgId: string;
}) {
  return prisma.alertRule.findFirst({
    where: { id: ruleId, monitor: { orgId } },
    include: {
      monitor: { select: { id: true, name: true } },
      subscriptions: {
        include: { channel: true },
      },
    },
  });
}
