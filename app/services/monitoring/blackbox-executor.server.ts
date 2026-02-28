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

  // Log key metrics for debugging failures
  if (!probeSuccess) {
    const metricsStr = Array.from(metrics.entries())
      .map(([k, v]) => `${k}=${v}`)
      .join("\\n  ");
    console.warn(
      `[blackbox] [Monitor ${input.monitorId}] Blackbox probe_success=0\\n  Available metrics:\\n  ${metricsStr}`
    );
  }

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
      console.error(
        `[blackbox] Target validation failed for ${input.url}:`,
        validatedTarget.error
      );
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
        raw: {
          validationError: validatedTarget.error,
          targetUrl: input.url,
        },
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
    const startTime = Date.now();
    console.log(
      `[blackbox] [Monitor ${input.monitorId}] Probing ${validatedTarget.url.toString()} via ${probeUrl}`
    );

    try {
      const response = await fetch(probeUrl, {
        signal: controller.signal,
      });

      const rawText = await response.text();
      const elapsedMs = Date.now() - startTime;

      console.log(
        `[blackbox] [Monitor ${input.monitorId}] Response: HTTP ${response.status} (${elapsedMs}ms)`
      );

      // Log non-200 responses from blackbox itself
      if (response.status !== 200) {
        console.warn(
          `[blackbox] [Monitor ${input.monitorId}] Blackbox returned non-200 status: ${response.status}\nResponse body:\n${rawText.slice(0, 500)}`
        );
      }

      // Verbose debug logging
      if (env.DEBUG_VERBOSE) {
        console.log(
          `[blackbox] [Monitor ${input.monitorId}] Raw metrics response (first 1000 chars):\n${rawText.slice(0, 1000)}`
        );
      }

      const metrics = parseMetrics(rawText);
      const evaluated = evaluate(input, metrics, rawText);

      if (!evaluated.ok) {
        console.warn(
          `[blackbox] [Monitor ${input.monitorId}] Probe failed: ${evaluated.failureReason} - ${evaluated.errorMessage}`
        );
      }

      return {
        ...evaluated,
        raw: {
          blackboxStatus: response.status,
          blackboxUrl: probeUrl,
          targetUrl: validatedTarget.url.toString(),
          elapsedMs,
          metrics: Object.fromEntries(metrics),
          metricsRaw: rawText.slice(0, 2000), // Include raw metrics for debugging
        },
      };
    } catch (error) {
      const elapsedMs = Date.now() - startTime;

      // Detailed error classification
      let errorType = "UNKNOWN";
      let errorMessage = "Failed to execute blackbox probe.";
      let errorDetails: Record<string, unknown> = {};

      if (error instanceof Error) {
        errorMessage = error.message;
        errorDetails = {
          name: error.name,
          message: error.message,
          stack: error.stack,
        };

        // Classify error type
        if (error.name === "AbortError") {
          errorType = "TIMEOUT";
          errorMessage = `Blackbox request timed out after ${input.timeoutMs}ms`;
        } else if (error.message.includes("ECONNREFUSED")) {
          errorType = "CONNECTION_REFUSED";
          errorMessage = `Blackbox exporter refused connection at ${env.BLACKBOX_BASE_URL}`;
        } else if (error.message.includes("ENOTFOUND")) {
          errorType = "DNS_FAILED";
          errorMessage = `Failed to resolve blackbox host: ${env.BLACKBOX_BASE_URL}`;
        } else if (error.message.includes("ETIMEDOUT")) {
          errorType = "NETWORK_TIMEOUT";
          errorMessage = `Network timeout connecting to blackbox exporter`;
        } else if (error.message.includes("ECONNRESET")) {
          errorType = "CONNECTION_RESET";
          errorMessage = `Connection reset by blackbox exporter`;
        }

        // Capture error cause chain
        if ("cause" in error && error.cause) {
          errorDetails.cause = error.cause;
          errorDetails.causeString = String(error.cause);
        }
      }

      console.error(
        `[blackbox] [Monitor ${input.monitorId}] ${errorType} error after ${elapsedMs}ms:`,
        `\n  Error: ${errorMessage}`,
        `\n  Blackbox URL: ${probeUrl}`,
        `\n  Target URL: ${validatedTarget.url.toString()}`,
        `\n  Timeout: ${input.timeoutMs}ms`,
        `\n  Full error:`,
        error
      );

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
        errorMessage: `[${errorType}] ${errorMessage}`,
        raw: {
          errorType,
          errorDetails,
          blackboxUrl: probeUrl,
          targetUrl: validatedTarget.url.toString(),
          elapsedMs,
          timeoutMs: input.timeoutMs,
        },
      };
    } finally {
      clearTimeout(timeout);
    }
  }
}
