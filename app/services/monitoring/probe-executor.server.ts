import type { BodyMatchType, ExpectedStatusMode, MonitorMethod } from "@prisma/client";

export type ProbeRequest = {
  monitorId: string;
  url: string;
  method: MonitorMethod;
  timeoutMs: number;
  expectedStatusMode: ExpectedStatusMode;
  expectedStatusCodes?: number[] | null;
  bodyMatchType: BodyMatchType;
  bodyMatchPattern?: string | null;
  latencyWarnMs?: number | null;
  tlsExpiryWarnDays?: number | null;
};

export type ProbeFailureReason = "NONE" | "NETWORK" | "TIMEOUT" | "BAD_STATUS" | "BODY_MISMATCH" | "TLS_EXPIRY";

export type ProbeExecutionResult = {
  ok: boolean;
  statusCode: number | null;
  latencyMs: number | null;
  dnsMs: number | null;
  connectMs: number | null;
  ttfbMs: number | null;
  tlsDaysRemaining: number | null;
  responseHeaders: Record<string, string>;
  responseSnippet: string | null;
  failureReason: ProbeFailureReason;
  errorMessage: string | null;
  raw: Record<string, unknown>;
};

export interface ProbeExecutor {
  execute(input: ProbeRequest): Promise<ProbeExecutionResult>;
}
