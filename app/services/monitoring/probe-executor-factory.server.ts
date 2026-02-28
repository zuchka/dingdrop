import { env } from "~/lib/env.server";
import { BlackboxProbeExecutor } from "~/services/monitoring/blackbox-executor.server";
import type { ProbeExecutor } from "~/services/monitoring/probe-executor.server";

const blackboxExecutor = new BlackboxProbeExecutor();

export function getProbeExecutor(): ProbeExecutor {
  if (env.PROBE_EXECUTOR === "blackbox") {
    return blackboxExecutor;
  }

  return blackboxExecutor;
}
