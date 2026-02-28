import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useEffect, useMemo, useState } from "react";
import { useFetcher, useLoaderData, useRevalidator } from "@remix-run/react";
import { Toast } from "~/components/ui/toast";
import { env } from "~/lib/env.server";
import { requireUserId } from "~/lib/session.server";
import { generateCurlCommand } from "~/lib/utils/curl";
import { formatBytes, formatTimestamp } from "~/lib/utils/format";
import { redactValue } from "~/lib/utils/redact";
import { getEndpointByIdForOrg } from "~/models/endpoint.server";
import { requireOrgMember } from "~/models/org.server";
import { getReplayAttemptsForRequest } from "~/models/replay.server";
import { getWebhookRequestByIdForEndpoint } from "~/models/webhook-request.server";

type Tab = "body" | "headers" | "meta";
type BodyMode = "pretty" | "raw";

function tabClass(active: boolean) {
  return `rounded px-3 py-1.5 text-sm ${active ? "bg-slate-900 text-white" : "border bg-white text-slate-700"}`;
}

function asRecord(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  const result: Record<string, string> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    result[key] = typeof item === "string" ? item : JSON.stringify(item);
  }
  return result;
}

export async function loader({ request, params }: LoaderFunctionArgs) {
  const userId = await requireUserId(request);
  const orgSlug = params.orgSlug;
  const endpointId = params.endpointId;
  const requestId = params.requestId;

  if (!orgSlug || !endpointId || !requestId) {
    throw new Response("Not Found", { status: 404 });
  }

  const org = await requireOrgMember(userId, orgSlug);
  const endpoint = await getEndpointByIdForOrg({ orgId: org.id, endpointId });
  if (!endpoint) {
    throw new Response("Not Found", { status: 404 });
  }

  const webhookRequest = await getWebhookRequestByIdForEndpoint({ endpointId: endpoint.id, requestId });
  if (!webhookRequest) {
    throw new Response("Not Found", { status: 404 });
  }

  const replayAttempts = await getReplayAttemptsForRequest(webhookRequest.id, 20);

  const requestHeaders = asRecord(webhookRequest.headers);
  const query = webhookRequest.query;

  const queryString =
    query && typeof query === "object"
      ? new URLSearchParams(
          Object.entries(query as Record<string, unknown>).flatMap(([key, value]) => {
            if (Array.isArray(value)) {
              return value.map((item) => [key, String(item)] as [string, string]);
            }
            if (value === null || value === undefined) {
              return [];
            }
            return [[key, String(value)] as [string, string]];
          }),
        ).toString()
      : "";

  const url = `${env.APP_BASE_URL}/i/${endpoint.key}${queryString ? `?${queryString}` : ""}`;
  const curlCommand = generateCurlCommand({
    url,
    method: webhookRequest.method,
    headers: {
      ...requestHeaders,
      "x-dingdrop-secret": endpoint.secret,
    },
    body: webhookRequest.bodyText,
  });

  return json({
    org: { slug: org.slug },
    endpoint: {
      id: endpoint.id,
      name: endpoint.name,
      defaultReplayUrl: endpoint.defaultReplayUrl,
    },
    request: {
      id: webhookRequest.id,
      method: webhookRequest.method,
      path: webhookRequest.path,
      query,
      headers: webhookRequest.headers,
      bodyText: webhookRequest.bodyText,
      bodyJson: webhookRequest.bodyJson,
      contentType: webhookRequest.contentType,
      sourceIp: webhookRequest.sourceIp,
      userAgent: webhookRequest.userAgent,
      sizeBytes: webhookRequest.sizeBytes,
      receivedAt: webhookRequest.receivedAt,
    },
    replayAttempts,
    replayActionPath: `/app/orgs/${org.slug}/endpoints/${endpoint.id}/requests/${webhookRequest.id}/replay`,
    curlCommand,
  });
}

export default function RequestDetailRoute() {
  const data = useLoaderData<typeof loader>();
  const replayFetcher = useFetcher<{ ok: boolean; errorMessage?: string; responseStatus?: number | null; durationMs?: number }>();
  const revalidator = useRevalidator();

  const [tab, setTab] = useState<Tab>("body");
  const [bodyMode, setBodyMode] = useState<BodyMode>("pretty");
  const [redact, setRedact] = useState(false);
  const [toast, setToast] = useState<{ tone: "success" | "error"; message: string } | null>(null);

  useEffect(() => {
    if (replayFetcher.state === "idle" && replayFetcher.data?.ok) {
      setToast({
        tone: "success",
        message: `Replay complete${typeof replayFetcher.data.responseStatus === "number" ? ` (${replayFetcher.data.responseStatus})` : ""}.`,
      });
      revalidator.revalidate();
    }
  }, [replayFetcher.state, replayFetcher.data, revalidator]);

  useEffect(() => {
    if (replayFetcher.state === "idle" && replayFetcher.data && !replayFetcher.data.ok) {
      setToast({ tone: "error", message: `Replay failed: ${replayFetcher.data.errorMessage ?? "Unknown error."}` });
    }
  }, [replayFetcher.state, replayFetcher.data]);

  const renderedHeaders = useMemo(
    () => (redact ? redactValue(data.request.headers) : data.request.headers),
    [data.request.headers, redact],
  );

  const renderedQuery = useMemo(
    () => (redact ? redactValue(data.request.query) : data.request.query),
    [data.request.query, redact],
  );

  const renderedBodyJson = useMemo(
    () => (redact ? redactValue(data.request.bodyJson) : data.request.bodyJson),
    [data.request.bodyJson, redact],
  );

  const renderedBodyText = useMemo(() => {
    if (!data.request.bodyText) return null;
    return redact ? (redactValue(data.request.bodyText) as string) : data.request.bodyText;
  }, [data.request.bodyText, redact]);

  const headerRows = Object.entries(asRecord(renderedHeaders));

  return (
    <div className="space-y-4">
      {toast ? <Toast tone={toast.tone} message={toast.message} onClose={() => setToast(null)} /> : null}
      <div className="rounded border bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold">Request {data.request.id}</h3>
            <p className="text-sm text-slate-600">
              {data.request.method} {data.request.path}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={redact} onChange={(event) => setRedact(event.target.checked)} />
              Redact sensitive values
            </label>
            <button
              type="button"
              className="rounded border px-3 py-1.5 text-sm"
              onClick={() => navigator.clipboard.writeText(data.curlCommand)}
            >
              Copy as cURL
            </button>
          </div>
        </div>

        <div className="mt-4 flex gap-2">
          <button type="button" className={tabClass(tab === "body")} onClick={() => setTab("body")}>
            Body
          </button>
          <button type="button" className={tabClass(tab === "headers")} onClick={() => setTab("headers")}>
            Headers
          </button>
          <button type="button" className={tabClass(tab === "meta")} onClick={() => setTab("meta")}>
            Meta
          </button>
        </div>
      </div>

      <section className="rounded border bg-white p-4">
        <h4 className="text-sm font-semibold">Replay</h4>
        <p className="mt-1 text-sm text-slate-600">
          Replays original method/body with allowed headers. Leave target blank to use endpoint default replay URL.
        </p>

        <replayFetcher.Form method="post" action={data.replayActionPath} className="mt-3 flex flex-wrap items-end gap-3">
          <label className="min-w-[320px] flex-1">
            <span className="mb-1 block text-sm">Target URL (optional)</span>
            <input
              name="targetUrl"
              type="url"
              placeholder={data.endpoint.defaultReplayUrl ?? "https://example.com/webhook-target"}
              className="w-full rounded border px-3 py-2"
            />
          </label>
          <button
            type="submit"
            className="rounded bg-slate-900 px-4 py-2 text-white disabled:opacity-60"
            disabled={replayFetcher.state !== "idle"}
          >
            {replayFetcher.state === "submitting" ? "Replaying..." : "Replay request"}
          </button>
        </replayFetcher.Form>

        {replayFetcher.state === "submitting" ? <p className="mt-2 text-sm text-slate-600">Running replay...</p> : null}
      </section>

      <section className="rounded border bg-white p-4">
        <h4 className="text-sm font-semibold">Replay attempts</h4>
        {data.replayAttempts.length === 0 ? (
          <p className="mt-2 text-sm text-slate-600">No replay attempts yet.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="bg-slate-50 text-left text-slate-600">
                <tr>
                  <th className="px-3 py-2">Time</th>
                  <th className="px-3 py-2">Target</th>
                  <th className="px-3 py-2">Result</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Duration</th>
                  <th className="px-3 py-2">Error</th>
                </tr>
              </thead>
              <tbody>
                {data.replayAttempts.map((attempt) => (
                  <tr key={attempt.id} className="border-t align-top">
                    <td className="px-3 py-2 text-slate-600">{formatTimestamp(attempt.createdAt)}</td>
                    <td className="px-3 py-2 break-all">{attempt.targetUrl}</td>
                    <td className="px-3 py-2">
                      <span className={`rounded px-2 py-1 text-xs ${attempt.ok ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
                        {attempt.ok ? "Success" : "Failed"}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-slate-600">{attempt.responseStatus ?? "-"}</td>
                    <td className="px-3 py-2 text-slate-600">{attempt.durationMs}ms</td>
                    <td className="px-3 py-2 text-slate-600">{attempt.errorMessage ?? "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {tab === "body" ? (
        <section className="rounded border bg-white p-4">
          <div className="mb-3 flex gap-2">
            <button type="button" className={tabClass(bodyMode === "pretty")} onClick={() => setBodyMode("pretty")}>
              Pretty JSON
            </button>
            <button type="button" className={tabClass(bodyMode === "raw")} onClick={() => setBodyMode("raw")}>
              Raw text
            </button>
          </div>

          {bodyMode === "pretty" ? (
            renderedBodyJson ? (
              <pre className="overflow-x-auto rounded bg-slate-50 p-3 text-xs">{JSON.stringify(renderedBodyJson, null, 2)}</pre>
            ) : (
              <p className="text-sm text-slate-600">No parseable JSON body.</p>
            )
          ) : renderedBodyText ? (
            <pre className="overflow-x-auto whitespace-pre-wrap rounded bg-slate-50 p-3 text-xs">{renderedBodyText}</pre>
          ) : (
            <p className="text-sm text-slate-600">No raw text body.</p>
          )}
        </section>
      ) : null}

      {tab === "headers" ? (
        <section className="overflow-x-auto rounded border bg-white">
          {headerRows.length === 0 ? (
            <div className="p-4 text-sm text-slate-600">No headers captured.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-slate-600">
                <tr>
                  <th className="px-4 py-3">Header</th>
                  <th className="px-4 py-3">Value</th>
                </tr>
              </thead>
              <tbody>
                {headerRows.map(([key, value]) => (
                  <tr key={key} className="border-t align-top">
                    <td className="px-4 py-3 font-mono text-xs">{key}</td>
                    <td className="px-4 py-3 font-mono text-xs break-all">{value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      ) : null}

      {tab === "meta" ? (
        <section className="rounded border bg-white p-4">
          <dl className="grid gap-3 md:grid-cols-2">
            <div>
              <dt className="text-xs uppercase tracking-wide text-slate-500">Received</dt>
              <dd className="text-sm">{formatTimestamp(data.request.receivedAt)}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-slate-500">Content-Type</dt>
              <dd className="text-sm">{data.request.contentType ?? "-"}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-slate-500">Size</dt>
              <dd className="text-sm">{formatBytes(data.request.sizeBytes)}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-slate-500">Source IP</dt>
              <dd className="text-sm">{data.request.sourceIp ?? "-"}</dd>
            </div>
            <div className="md:col-span-2">
              <dt className="text-xs uppercase tracking-wide text-slate-500">User Agent</dt>
              <dd className="text-sm break-all">{data.request.userAgent ?? "-"}</dd>
            </div>
            <div className="md:col-span-2">
              <dt className="text-xs uppercase tracking-wide text-slate-500">Query params</dt>
              <dd>
                {renderedQuery ? (
                  <pre className="overflow-x-auto rounded bg-slate-50 p-3 text-xs">{JSON.stringify(renderedQuery, null, 2)}</pre>
                ) : (
                  <span className="text-sm">-</span>
                )}
              </dd>
            </div>
          </dl>
        </section>
      ) : null}
    </div>
  );
}
