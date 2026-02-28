import { REPLAY_ALLOWED_HEADERS, REPLAY_TIMEOUT_MS } from "~/lib/constants";
import { createReplayAttempt } from "~/models/replay.server";

type ReplayableRequest = {
  id: string;
  method: string;
  headers: unknown;
  bodyRaw: Buffer;
};

type ReplayEndpoint = {
  defaultReplayUrl: string | null;
};

function toRecord(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  const out: Record<string, string> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    if (typeof item === "string") {
      out[key.toLowerCase()] = item;
    }
  }
  return out;
}

export function buildReplayHeaders(headers: unknown) {
  const normalized = toRecord(headers);
  const result: Record<string, string> = {};

  for (const allowedHeader of REPLAY_ALLOWED_HEADERS) {
    const value = normalized[allowedHeader];
    if (value) {
      result[allowedHeader] = value;
    }
  }

  return result;
}

function resolveTargetUrl(explicitTargetUrl: string | null, endpoint: ReplayEndpoint) {
  const targetUrl = explicitTargetUrl || endpoint.defaultReplayUrl;
  if (!targetUrl) {
    throw new Error("Replay target URL is required.");
  }

  let parsed: URL;
  try {
    parsed = new URL(targetUrl);
  } catch {
    throw new Error("Replay target URL is invalid.");
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("Replay target URL must use http or https.");
  }

  return parsed.toString();
}

export async function replayWebhook({
  webhookRequest,
  endpoint,
  explicitTargetUrl,
}: {
  webhookRequest: ReplayableRequest;
  endpoint: ReplayEndpoint;
  explicitTargetUrl: string | null;
}) {
  const targetUrl = resolveTargetUrl(explicitTargetUrl, endpoint);
  const headers = buildReplayHeaders(webhookRequest.headers);

  const started = Date.now();
  const abort = new AbortController();
  const timeout = setTimeout(() => abort.abort(), REPLAY_TIMEOUT_MS);
  const replayBody = Uint8Array.from(webhookRequest.bodyRaw);

  let responseStatus: number | null = null;
  let responseBody: string | null = null;
  let ok = false;
  let errorMessage: string | null = null;

  try {
    const response = await fetch(targetUrl, {
      method: webhookRequest.method,
      headers,
      body: replayBody.byteLength > 0 ? new Blob([replayBody]) : undefined,
      signal: abort.signal,
    });

    responseStatus = response.status;
    responseBody = (await response.text()).slice(0, 20_000);
    ok = response.ok;
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : "Replay failed.";
  } finally {
    clearTimeout(timeout);
  }

  const durationMs = Date.now() - started;

  return createReplayAttempt({
    webhookRequestId: webhookRequest.id,
    targetUrl,
    requestHeaders: headers,
    responseStatus,
    responseBody,
    ok,
    durationMs,
    errorMessage,
  });
}
