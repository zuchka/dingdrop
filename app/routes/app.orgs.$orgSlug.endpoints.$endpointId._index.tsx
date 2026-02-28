import type { LoaderFunctionArgs } from "@remix-run/node";
import { Form, Link, useLoaderData } from "@remix-run/react";
import { json } from "@remix-run/node";
import { requireUserId } from "~/lib/session.server";
import { formatBytes, formatTimestamp } from "~/lib/utils/format";
import { getEndpointByIdForOrg } from "~/models/endpoint.server";
import { requireOrgMember } from "~/models/org.server";
import { getEndpointInboxRequests } from "~/models/webhook-request.server";

function methodBadgeClass(method: string) {
  const base = "inline-flex rounded px-2 py-1 text-xs font-medium";
  if (method === "GET") return `${base} bg-blue-100 text-blue-700`;
  if (method === "POST") return `${base} bg-emerald-100 text-emerald-700`;
  if (method === "PUT" || method === "PATCH") return `${base} bg-amber-100 text-amber-700`;
  if (method === "DELETE") return `${base} bg-red-100 text-red-700`;
  return `${base} bg-slate-200 text-slate-700`;
}

export async function loader({ request, params }: LoaderFunctionArgs) {
  const userId = await requireUserId(request);
  const orgSlug = params.orgSlug;
  const endpointId = params.endpointId;

  if (!orgSlug || !endpointId) {
    throw new Response("Not Found", { status: 404 });
  }

  const org = await requireOrgMember(userId, orgSlug);
  const endpoint = await getEndpointByIdForOrg({ orgId: org.id, endpointId });

  if (!endpoint) {
    throw new Response("Not Found", { status: 404 });
  }

  const url = new URL(request.url);
  const method = String(url.searchParams.get("method") ?? "").toUpperCase().trim();
  const contentType = String(url.searchParams.get("contentType") ?? "").trim();

  const requests = await getEndpointInboxRequests({
    endpointId: endpoint.id,
    method: method || undefined,
    contentType: contentType || undefined,
  });

  return json({
    org: { slug: org.slug },
    endpoint: { id: endpoint.id },
    filters: { method, contentType },
    requests,
  });
}

export default function EndpointInboxRoute() {
  const { org, endpoint, filters, requests } = useLoaderData<typeof loader>();

  return (
    <div className="space-y-4">
      <div className="rounded border bg-white p-4">
        <Form method="get" className="grid gap-3 md:grid-cols-[220px_1fr_auto] md:items-end">
          <label className="block">
            <span className="mb-1 block text-sm">Method</span>
            <select name="method" defaultValue={filters.method} className="w-full rounded border px-3 py-2">
              <option value="">All methods</option>
              <option value="GET">GET</option>
              <option value="POST">POST</option>
              <option value="PUT">PUT</option>
              <option value="PATCH">PATCH</option>
              <option value="DELETE">DELETE</option>
            </select>
          </label>

          <label className="block">
            <span className="mb-1 block text-sm">Content-Type contains</span>
            <input
              name="contentType"
              type="text"
              defaultValue={filters.contentType}
              placeholder="application/json"
              className="w-full rounded border px-3 py-2"
            />
          </label>

          <button type="submit" className="rounded bg-slate-900 px-4 py-2 text-white">
            Apply filters
          </button>
        </Form>
      </div>

      {requests.length === 0 ? (
        <div className="rounded border bg-white p-6 text-slate-600">
          {filters.method || filters.contentType
            ? "No requests match your current filters."
            : "No requests captured yet. Send a webhook to this endpoint to populate the inbox."}
        </div>
      ) : (
        <div className="overflow-x-auto rounded border bg-white">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-slate-50 text-left text-slate-600">
              <tr>
                <th className="px-4 py-3">Method</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Received</th>
                <th className="px-4 py-3">Content-Type</th>
                <th className="px-4 py-3">Size</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {requests.map((request) => (
                <tr key={request.id} className="border-t">
                  <td className="px-4 py-3">
                    <span className={methodBadgeClass(request.method)}>{request.method}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded bg-emerald-100 px-2 py-1 text-xs text-emerald-700">Captured</span>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{formatTimestamp(request.receivedAt)}</td>
                  <td className="px-4 py-3 text-slate-600">{request.contentType ?? "-"}</td>
                  <td className="px-4 py-3 text-slate-600">{formatBytes(request.sizeBytes)}</td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      to={`/app/orgs/${org.slug}/endpoints/${endpoint.id}/requests/${request.id}`}
                      className="underline"
                    >
                      View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
