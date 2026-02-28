import type { MonitorCurrentStatus } from "@prisma/client";
import { prisma } from "~/lib/db.server";
import type { ProbeExecutionResult } from "~/services/monitoring/probe-executor.server";
import { evaluateMonitorAlertState } from "~/services/monitoring/alert-engine.server";

export async function applyProbeResultToMonitorState({
  monitorId,
  probeRunId,
  result,
}: {
  monitorId: string;
  probeRunId: string;
  result: ProbeExecutionResult;
}) {
  const now = new Date();
  const nextStatus: MonitorCurrentStatus = result.ok ? "UP" : "DOWN";

  const updated = await prisma.monitorState.upsert({
    where: { monitorId },
    create: {
      monitorId,
      currentStatus: nextStatus,
      consecutiveFailures: result.ok ? 0 : 1,
      consecutiveSuccesses: result.ok ? 1 : 0,
      lastFailureAt: result.ok ? null : now,
      lastSuccessAt: result.ok ? now : null,
      lastProbeRunId: probeRunId,
    },
    update: {
      currentStatus: nextStatus,
      consecutiveFailures: result.ok ? 0 : { increment: 1 },
      consecutiveSuccesses: result.ok ? { increment: 1 } : 0,
      lastFailureAt: result.ok ? undefined : now,
      lastSuccessAt: result.ok ? now : undefined,
      lastProbeRunId: probeRunId,
    },
  });

  await evaluateMonitorAlertState({
    monitorId,
    consecutiveFailures: updated.consecutiveFailures,
    consecutiveSuccesses: updated.consecutiveSuccesses,
  });

  return updated;
}
