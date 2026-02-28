import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { env } from "~/lib/env.server";
import { getProbeQueueDepth } from "~/models/monitoring/probe-job.server";

export async function loader({}: LoaderFunctionArgs) {
  const queue = await getProbeQueueDepth();

  return json({
    ok: true,
    schedulerEnabled: env.ENABLE_PROBE_SCHEDULER,
    workerEnabled: env.ENABLE_PROBE_WORKER,
    notificationsEnabled: env.ENABLE_NOTIFICATIONS,
    queueDepth: queue,
    now: new Date().toISOString(),
  });
}

export default function MonitoringHealthRoute() {
  return null;
}
