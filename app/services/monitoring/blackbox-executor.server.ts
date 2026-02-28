import { PROBE_SNIPPET_MAX_BYTES } from "~/lib/constants";
import { env } from "~/lib/env.server";
import { validateMonitorTargetUrlWithDns } from "~/services/monitoring/target-policy.server";
import type { ProbeExecutionResult, ProbeExecutor, ProbeRequest } from "~/services/monitoring/probe-executor.server";

function parseMetrics(text: string) {
  const metrics = new Map<string, number>();

  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const space = line.lastIndexOf(" ");
    if (space === -1) continue;

    const keyPart = line.slice(0, space);
    const key = keyPart.includes("{") ? keyPart.slice(0, keyPart.indexOf("{")) : keyPart;
    const value = Number(line.slice(space + 1));

    if (!Number.isFinite(value)) continue;
    if (!metrics.has(key)) {
      metrics.set(key, value);
    }
  }

  return metrics;
}

function evaluate(input: ProbeRequest, metrics: Map<string, number>, rawText: string): Omit<ProbeExecutionResult, "raw"> {
  const probeSuccess = metrics.get("probe_success") === 1;
  const statusCode = Number.isFinite(metrics.get("probe_http_status_code") ?? NaN)
    ? Number(metrics.get("probe_http_status_code"))
    : null;
  const latencyMs = Number.isFinite(metrics.get("probe_duration_seconds") ?? NaN)
    ? Math.round(Number(metrics.get("probe_duration_seconds")) * 1000)
    : null;

  const nowSec = Date.now() / 1000;
  const certExpiry = metrics.get("probe_ssl_earliest_cert_expiry");
  const tlsDaysRemaining = Number.isFinite(certExpiry ?? NaN)
    ? Math.floor((Number(certExpiry) - nowSec) / (60 * 60 * 24))
    : null;

  let ok = probeSuccess;
  let failureReason: ProbeExecutionResult["failureReason"] = probeSuccess ? "NONE" : "NETWORK";
  let errorMessage: string | null = probeSuccess ? null : "Blackbox probe reported failure.";

  if (ok && input.expectedStatusMode === "RANGE_2XX" && statusCode != null && (statusCode < 200 || statusCode >= 300)) {
    ok = false;
    failureReason = "BAD_STATUS";
    errorMessage = `Unexpected status ${statusCode}`;
  }

  if (
    ok &&
    input.expectedStatusMode === "EXACT_SET" &&
    input.expectedStatusCodes &&
    statusCode != null &&
    !input.expectedStatusCodes.includes(statusCode)
  ) {
    ok = false;
    failureReason = "BAD_STATUS";
    errorMessage = `Unexpected status ${statusCode}`;
  }

  if (ok && input.latencyWarnMs && latencyMs != null && latencyMs > input.latencyWarnMs) {
    ok = false;
    failureReason = "TIMEOUT";
    errorMessage = `Latency ${latencyMs}ms exceeded threshold ${input.latencyWarnMs}ms`;
  }

  if (ok && input.tlsExpiryWarnDays && tlsDaysRemaining != null && tlsDaysRemaining <= input.tlsExpiryWarnDays) {
    ok = false;
    failureReason = "TLS_EXPIRY";
    errorMessage = `TLS certificate expires in ${tlsDaysRemaining} days`;
  }

  if (ok && input.bodyMatchType !== "NONE" && input.bodyMatchPattern) {
    if (input.bodyMatchType === "CONTAINS") {
      if (!rawText.includes(input.bodyMatchPattern)) {
        ok = false;
        failureReason = "BODY_MISMATCH";
        errorMessage = "Body does not contain expected pattern.";
      }
    } else {
      const regex = new RegExp(input.bodyMatchPattern);
      if (!regex.test(rawText)) {
        ok = false;
        failureReason = "BODY_MISMATCH";
        errorMessage = "Body does not match expected regex.";
      }
    }
  }

  return {
    ok,
    statusCode,
    latencyMs,
    dnsMs: null,
    connectMs: null,
    ttfbMs: null,
    tlsDaysRemaining,
    responseHeaders: {},
    responseSnippet: rawText.slice(0, PROBE_SNIPPET_MAX_BYTES),
    failureReason,
    errorMessage,
  };
}

export class BlackboxProbeExecutor implements ProbeExecutor {
  async execute(input: ProbeRequest): Promise<ProbeExecutionResult> {
    const validatedTarget = await validateMonitorTargetUrlWithDns(input.url);
    if (!validatedTarget.ok) {
      return {
        ok: false,
        statusCode: null,
        latencyMs: null,
        dnsMs: null,
        connectMs: null,
        ttfbMs: null,
        tlsDaysRemaining: null,
        responseHeaders: {},
        responseSnippet: null,
        failureReason: "NETWORK",
        errorMessage: validatedTarget.error,
        raw: {},
      };
    }

    const params = new URLSearchParams({
      target: validatedTarget.url.toString(),
      module: env.BLACKBOX_HTTP_MODULE,
      debug: "true",
    });

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), input.timeoutMs);

    const probeUrl = `${env.BLACKBOX_BASE_URL}/probe?${params.toString()}`;
    console.log(`[blackbox] Probing ${probeUrl}`);

    try {
      const response = await fetch(probeUrl, {
        signal: controller.signal,
      });

      const rawText = await response.text();
      const metrics = parseMetrics(rawText);
      const evaluated = evaluate(input, metrics, rawText);

      return {
        ...evaluated,
        raw: {
          blackboxStatus: response.status,
          metrics: Object.fromEntries(metrics),
        },
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to execute blackbox probe.";
      console.error(`[blackbox] Error probing ${probeUrl}:`, errorMessage);
      return {
        ok: false,
        statusCode: null,
        latencyMs: null,
        dnsMs: null,
        connectMs: null,
        ttfbMs: null,
        tlsDaysRemaining: null,
        responseHeaders: {},
        responseSnippet: null,
        failureReason: "NETWORK",
        errorMessage,
        raw: {},
      };
    } finally {
      clearTimeout(timeout);
    }
  }
}
