import type { BodyMatchType, ExpectedStatusMode, MonitorMethod, Prisma } from "@prisma/client";
import { prisma } from "~/lib/db.server";

export type CreateMonitorInput = {
  orgId: string;
  name: string;
  url: string;
  method: MonitorMethod;
  intervalSec: number;
  timeoutMs: number;
  expectedStatusMode: ExpectedStatusMode;
  expectedStatusCodes: number[] | null;
  bodyMatchType: BodyMatchType;
  bodyMatchPattern: string | null;
  latencyWarnMs: number | null;
  tlsExpiryWarnDays: number | null;
};

export function listMonitorsForOrg(orgId: string) {
  return prisma.monitor.findMany({
    where: { orgId },
    orderBy: { createdAt: "desc" },
    include: {
      state: true,
      probeRuns: {
        take: 5, // Reduced from 50 to avoid N+1 query performance issues on list view
        orderBy: { startedAt: "desc" },
        select: { ok: true, latencyMs: true, startedAt: true },
      },
      _count: { select: { incidents: { where: { status: "OPEN" } } } },
    },
  });
}

export function getMonitorForOrg(orgId: string, monitorId: string) {
  return prisma.monitor.findFirst({
    where: { id: monitorId, orgId },
    include: {
      state: true,
      alertRules: true,
    },
  });
}

export async function createMonitor(input: CreateMonitorInput) {
  const expectedStatusCodes: Prisma.InputJsonValue | undefined = input.expectedStatusCodes ?? undefined;

  return prisma.monitor.create({
    data: {
      orgId: input.orgId,
      name: input.name,
      url: input.url,
      method: input.method,
      intervalSec: input.intervalSec,
      timeoutMs: input.timeoutMs,
      expectedStatusMode: input.expectedStatusMode,
      expectedStatusCodes,
      bodyMatchType: input.bodyMatchType,
      bodyMatchPattern: input.bodyMatchPattern,
      latencyWarnMs: input.latencyWarnMs,
      tlsExpiryWarnDays: input.tlsExpiryWarnDays,
      state: {
        create: {},
      },
      alertRules: {
        create: {
          ruleType: "DOWN",
          enabled: true,
          severity: "CRITICAL",
        },
      },
    },
  });
}

export function updateMonitorForOrg(orgId: string, monitorId: string, data: Prisma.MonitorUpdateInput) {
  return prisma.monitor.updateMany({
    where: { id: monitorId, orgId },
    data,
  });
}

export function listActiveMonitors() {
  return prisma.monitor.findMany({
    where: { isActive: true },
    select: {
      id: true,
      orgId: true,
      url: true,
      method: true,
      intervalSec: true,
      timeoutMs: true,
      expectedStatusMode: true,
      expectedStatusCodes: true,
      bodyMatchType: true,
      bodyMatchPattern: true,
      latencyWarnMs: true,
      tlsExpiryWarnDays: true,
    },
  });
}
