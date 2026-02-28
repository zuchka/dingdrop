import type { IncidentSeverity, IncidentStatus } from "@prisma/client";
import { prisma } from "~/lib/db.server";

export function getOpenIncidentForMonitor(monitorId: string) {
  return prisma.incident.findFirst({
    where: { monitorId, status: "OPEN" },
    orderBy: { openedAt: "desc" },
  });
}

export function openIncident(monitorId: string, severity: "CRITICAL" | "WARNING", reason: string) {
  return prisma.incident.create({
    data: {
      monitorId,
      status: "OPEN",
      severity,
      openReason: reason,
    },
  });
}

export function resolveIncident(incidentId: string, reason: string) {
  return prisma.incident.update({
    where: { id: incidentId },
    data: {
      status: "RESOLVED",
      resolveReason: reason,
      resolvedAt: new Date(),
    },
  });
}

export function listIncidentsForMonitor(monitorId: string, take = 50) {
  return prisma.incident.findMany({
    where: { monitorId },
    orderBy: { openedAt: "desc" },
    take,
  });
}

/**
 * Get incident with full details including monitor, events, and notifications
 */
export async function getIncidentWithDetails({
  incidentId,
  orgId,
}: {
  incidentId: string;
  orgId: string;
}) {
  return prisma.incident.findFirst({
    where: {
      id: incidentId,
      monitor: { orgId },
    },
    include: {
      monitor: {
        select: {
          id: true,
          name: true,
          url: true,
        },
      },
      events: {
        include: {
          channel: {
            select: {
              id: true,
              name: true,
              type: true,
            },
          },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });
}

/**
 * Get incidents with pagination and filtering
 */
export async function getIncidentsWithPagination({
  orgId,
  page = 1,
  pageSize = 20,
  filters = {},
}: {
  orgId: string;
  page?: number;
  pageSize?: number;
  filters?: {
    status?: IncidentStatus;
    severity?: IncidentSeverity;
    monitorId?: string;
    startDate?: Date;
    endDate?: Date;
  };
}) {
  const where: any = {
    monitor: { orgId },
  };

  if (filters.status) {
    where.status = filters.status;
  }

  if (filters.severity) {
    where.severity = filters.severity;
  }

  if (filters.monitorId) {
    where.monitorId = filters.monitorId;
  }

  if (filters.startDate || filters.endDate) {
    where.openedAt = {};
    if (filters.startDate) {
      where.openedAt.gte = filters.startDate;
    }
    if (filters.endDate) {
      where.openedAt.lte = filters.endDate;
    }
  }

  const [incidents, totalCount] = await Promise.all([
    prisma.incident.findMany({
      where,
      include: {
        monitor: {
          select: { id: true, name: true },
        },
        _count: {
          select: { events: true },
        },
      },
      orderBy: { openedAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.incident.count({ where }),
  ]);

  return {
    incidents,
    totalCount,
    page,
    pageSize,
    totalPages: Math.ceil(totalCount / pageSize),
  };
}

/**
 * Manually resolve an incident (for user-initiated resolution)
 */
export async function manuallyResolveIncident({
  incidentId,
  orgId,
  userId,
  reason,
}: {
  incidentId: string;
  orgId: string;
  userId: string;
  reason: string;
}) {
  // Verify incident belongs to org
  const incident = await prisma.incident.findFirst({
    where: { id: incidentId, monitor: { orgId } },
  });

  if (!incident) {
    throw new Error("Incident not found or does not belong to organization");
  }

  if (incident.status === "RESOLVED") {
    throw new Error("Incident is already resolved");
  }

  return resolveIncident(incidentId, `Manually resolved by user: ${reason}`);
}
