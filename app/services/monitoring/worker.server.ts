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
      console.log(
        `[worker] Processing probe job ${job.id} for monitor ${job.monitorId} (region: ${job.region})`
      );

      const monitor = await prisma.monitor.findUnique({ where: { id: job.monitorId } });

      if (!monitor) {
        console.error(`[worker] Monitor ${job.monitorId} not found for job ${job.id}`);
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

      console.log(`[worker] Completed probe job ${job.id} successfully`);
      await markProbeJobDone(job.id);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown worker error.";
      console.error(
        `[worker] Failed to process job ${job.id} for monitor ${job.monitorId}:`,
        `\\n  Error: ${errorMessage}`,
        `\\n  Job ID: ${job.id}`,
        `\\n  Monitor ID: ${job.monitorId}`,
        `\\n  Region: ${job.region}`,
        `\\n  Stack trace:`,
        error instanceof Error ? error.stack : error
      );
      await markProbeJobFailed(job.id, errorMessage);
    }
  }

  return { processed: jobs.length };
}
