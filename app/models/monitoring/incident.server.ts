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
