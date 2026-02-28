import type { Prisma } from "@prisma/client";
import { MAX_WEBHOOK_BODY_BYTES } from "~/lib/constants";
import { secretsMatch } from "~/lib/security";
import { getEndpointByKey } from "~/models/endpoint.server";
import { createWebhookRequest } from "~/models/webhook-request.server";

type NormalizedIncomingWebhook = {
  endpointId: string;
  method: string;
  path: string;
  query: Prisma.InputJsonValue | null;
  headers: Prisma.InputJsonValue;
  bodyRaw: Buffer;
  bodyText: string | null;
  bodyJson: Prisma.InputJsonValue | null;
  contentType: string | null;
  sourceIp: string | null;
  userAgent: string | null;
  sizeBytes: number;
};

function parseQuery(url: URL): Prisma.InputJsonValue | null {
  if (![...url.searchParams.keys()].length) {
    return null;
  }

  const result: Record<string, string | string[]> = {};
  for (const key of new Set(url.searchParams.keys())) {
    const values = url.searchParams.getAll(key);
    result[key] = values.length > 1 ? values : (values[0] ?? "");
  }

  return result as Prisma.InputJsonValue;
}

function parseHeaders(headers: Headers): Prisma.InputJsonValue {
  const result: Record<string, string> = {};
  for (const [key, value] of headers.entries()) {
    result[key.toLowerCase()] = value;
  }
  return result as Prisma.InputJsonValue;
}

function resolveSourceIp(headers: Headers): string | null {
  const forwardedFor = headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() || null;
  }

  return headers.get("cf-connecting-ip") || headers.get("x-real-ip") || null;
}

function parseBody(contentType: string | null, bodyRaw: Buffer) {
  if (bodyRaw.length === 0) {
    return { bodyText: null, bodyJson: null };
  }

  const decoder = new TextDecoder("utf-8", { fatal: false });
  const bodyText = decoder.decode(bodyRaw);

  const shouldTryJson = Boolean(contentType && (contentType.includes("application/json") || contentType.includes("+json")));
  if (!shouldTryJson) {
    return { bodyText, bodyJson: null };
  }

  try {
    const parsed = JSON.parse(bodyText) as Prisma.InputJsonValue;
    return { bodyText, bodyJson: parsed };
  } catch {
    return { bodyText, bodyJson: null };
  }
}

export async function normalizeIncomingWebhook(request: Request, endpointId: string): Promise<NormalizedIncomingWebhook> {
  const url = new URL(request.url);
  const bodyRaw = Buffer.from(await request.arrayBuffer());

  if (bodyRaw.length > MAX_WEBHOOK_BODY_BYTES) {
    throw new Response("Payload too large", { status: 413 });
  }

  const contentType = request.headers.get("content-type");
  const userAgent = request.headers.get("user-agent");
  const { bodyText, bodyJson } = parseBody(contentType, bodyRaw);

  return {
    endpointId,
    method: request.method,
    path: url.pathname,
    query: parseQuery(url),
    headers: parseHeaders(request.headers),
    bodyRaw,
    bodyText,
    bodyJson,
    contentType,
    sourceIp: resolveSourceIp(request.headers),
    userAgent,
    sizeBytes: bodyRaw.length,
  };
}

export async function applyTransforms(normalized: NormalizedIncomingWebhook) {
  return normalized;
}

export async function storeWebhook(normalized: NormalizedIncomingWebhook) {
  return createWebhookRequest(normalized);
}

export async function ingestWebhook({ request, endpointKey }: { request: Request; endpointKey: string }) {
  const endpoint = await getEndpointByKey(endpointKey);

  if (!endpoint) {
    throw new Response("Endpoint not found", { status: 404 });
  }

  if (!endpoint.isActive) {
    throw new Response("Endpoint is inactive", { status: 403 });
  }

  const url = new URL(request.url);
  const providedSecret = request.headers.get("x-dingdrop-secret") ?? url.searchParams.get("secret");

  if (!secretsMatch(endpoint.secret, providedSecret)) {
    throw new Response("Unauthorized", { status: 401 });
  }

  const normalized = await normalizeIncomingWebhook(request, endpoint.id);
  const transformed = await applyTransforms(normalized);
  return storeWebhook(transformed);
}
