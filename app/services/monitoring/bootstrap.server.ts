import { SCHEDULER_TICK_MS } from "~/lib/constants";
import { env } from "~/lib/env.server";
import { runNotificationDispatchBatch } from "~/services/monitoring/notifier.server";
import { runMonitoringRetentionPass } from "~/services/monitoring/retention.server";
import { runSchedulerTick } from "~/services/monitoring/scheduler.server";
import { runProbeWorkerBatch } from "~/services/monitoring/worker.server";

const globalForMonitoring = globalThis as unknown as {
  monitoringBootstrapped?: boolean;
  workerRunning?: boolean;
};

export function bootstrapMonitoringBackgroundProcesses() {
  if (globalForMonitoring.monitoringBootstrapped) {
    return;
  }

  globalForMonitoring.monitoringBootstrapped = true;

  if (env.ENABLE_PROBE_SCHEDULER) {
    setInterval(() => {
      runSchedulerTick().catch((error) => {
        console.error("[monitoring:scheduler]", error);
      });
    }, SCHEDULER_TICK_MS).unref();
  }

  if (env.ENABLE_PROBE_WORKER) {
    setInterval(() => {
      if (globalForMonitoring.workerRunning) return;
      globalForMonitoring.workerRunning = true;

      runProbeWorkerBatch()
        .catch((error) => {
          console.error("[monitoring:worker]", error);
        })
        .finally(() => {
          globalForMonitoring.workerRunning = false;
        });
    }, 1_000).unref();
  }

  if (env.ENABLE_NOTIFICATIONS) {
    setInterval(() => {
      runNotificationDispatchBatch().catch((error) => {
        console.error("[monitoring:notifier]", error);
      });
    }, 5_000).unref();
  }

  setInterval(() => {
    runMonitoringRetentionPass().catch((error) => {
      console.error("[monitoring:retention]", error);
    });
  }, 60 * 60 * 1000).unref();
}
