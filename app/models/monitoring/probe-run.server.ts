import { prisma } from "~/lib/db.server";
import { toPrismaJsonValue } from "~/lib/utils/json.server";

export type CreateProbeRunInput = {
  monitorId: string;
  region: string;
  executorType: "BLACKBOX" | "NATIVE";
  startedAt: Date;
  finishedAt: Date;
  ok: boolean;
  failureReason: "NONE" | "NETWORK" | "TIMEOUT" | "BAD_STATUS" | "BODY_MISMATCH" | "TLS_EXPIRY";
  statusCode: number | null;
  latencyMs: number | null;
  dnsMs: number | null;
  connectMs: number | null;
  ttfbMs: number | null;
  tlsDaysRemaining: number | null;
  responseHeaders: Record<string, string> | null;
  responseSnippet: string | null;
  errorMessage: string | null;
  rawResult: Record<string, unknown> | null;
};

export function createProbeRun(data: CreateProbeRunInput) {
  const responseHeaders = toPrismaJsonValue(data.responseHeaders);
  const rawResult = toPrismaJsonValue(data.rawResult);

  return prisma.probeRun.create({
    data: {
      ...data,
      responseHeaders,
      rawResult,
    },
  });
}

export function getMonitorProbeRuns(monitorId: string, take = 100) {
  return prisma.probeRun.findMany({
    where: { monitorId },
    orderBy: { startedAt: "desc" },
    take,
  });
}
