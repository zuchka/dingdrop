import pLimit from "p-limit";
import { getProbeExecutor } from "~/services/monitoring/probe-executor-factory.server";
import { createProbeRun } from "~/models/monitoring/probe-run.server";
import { claimDueProbeJobs, markProbeJobDone, markProbeJobFailed } from "~/models/monitoring/probe-job.server";
import { getMonitorForOrg } from "~/models/monitoring/monitor.server";
import { prisma } from "~/lib/db.server";
import { parseExpectedStatusCodes } from "~/lib/utils/json.server";
import { applyProbeResultToMonitorState } from "~/services/monitoring/state-engine.server";
import { logger } from "~/lib/logger.server";

export async function runProbeWorkerBatch(limit = 10, concurrency = 5) {
  const jobs = await claimDueProbeJobs(limit);
  if (jobs.length === 0) return { processed: 0 };

  const executor = getProbeExecutor();
  const limitConcurrency = pLimit(concurrency);

  // Process jobs in parallel with controlled concurrency
  await Promise.all(
    jobs.map((job) =>
      limitConcurrency(async () => {
        try {
          logger.info({ jobId: job.id, monitorId: job.monitorId, region: job.region }, "Processing probe job");

          const monitor = await prisma.monitor.findUnique({ where: { id: job.monitorId } });

          if (!monitor) {
            logger.error({ jobId: job.id, monitorId: job.monitorId }, "Monitor not found for job");
            await markProbeJobFailed(job.id, "Monitor not found.");
            return;
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

          logger.info({ jobId: job.id, monitorId: monitor.id }, "Probe job completed successfully");
          await markProbeJobDone(job.id);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : "Unknown worker error.";
          logger.error(
            {
              err: error,
              jobId: job.id,
              monitorId: job.monitorId,
              region: job.region,
              errorMessage,
            },
            "Failed to process probe job"
          );
          await markProbeJobFailed(job.id, errorMessage);
        }
      })
    )
  );

  return { processed: jobs.length };
}
