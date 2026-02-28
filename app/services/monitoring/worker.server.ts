import { getProbeExecutor } from "~/services/monitoring/probe-executor-factory.server";
import { createProbeRun } from "~/models/monitoring/probe-run.server";
import { claimDueProbeJobs, markProbeJobDone, markProbeJobFailed } from "~/models/monitoring/probe-job.server";
import { getMonitorForOrg } from "~/models/monitoring/monitor.server";
import { prisma } from "~/lib/db.server";
import { parseExpectedStatusCodes } from "~/lib/utils/json.server";
import { applyProbeResultToMonitorState } from "~/services/monitoring/state-engine.server";

export async function runProbeWorkerBatch(limit = 10) {
  const jobs = await claimDueProbeJobs(limit);
  if (jobs.length === 0) return { processed: 0 };

  const executor = getProbeExecutor();

  for (const job of jobs) {
    try {
      const monitor = await prisma.monitor.findUnique({ where: { id: job.monitorId } });

      if (!monitor) {
        await markProbeJobFailed(job.id, "Monitor not found.");
        continue;
      }

      const startedAt = new Date();
      const expectedStatusCodes = parseExpectedStatusCodes(monitor.expectedStatusCodes);

      const result = await executor.execute({
        monitorId: monitor.id,
        url: monitor.url,
        method: monitor.method,
        timeoutMs: monitor.timeoutMs,
        expectedStatusMode: monitor.expectedStatusMode,
        expectedStatusCodes,
        bodyMatchType: monitor.bodyMatchType,
        bodyMatchPattern: monitor.bodyMatchPattern,
        latencyWarnMs: monitor.latencyWarnMs,
        tlsExpiryWarnDays: monitor.tlsExpiryWarnDays,
      });

      const finishedAt = new Date();

      const run = await createProbeRun({
        monitorId: monitor.id,
        region: job.region,
        executorType: "BLACKBOX",
        startedAt,
        finishedAt,
        ok: result.ok,
        failureReason: result.failureReason,
        statusCode: result.statusCode,
        latencyMs: result.latencyMs,
        dnsMs: result.dnsMs,
        connectMs: result.connectMs,
        ttfbMs: result.ttfbMs,
        tlsDaysRemaining: result.tlsDaysRemaining,
        responseHeaders: result.responseHeaders,
        responseSnippet: result.responseSnippet,
        errorMessage: result.errorMessage,
        rawResult: result.raw,
      });

      await applyProbeResultToMonitorState({
        monitorId: monitor.id,
        probeRunId: run.id,
        result,
      });

      await markProbeJobDone(job.id);
    } catch (error) {
      await markProbeJobFailed(job.id, error instanceof Error ? error.message : "Unknown worker error.");
    }
  }

  return { processed: jobs.length };
}
