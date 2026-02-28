import type { LoaderFunctionArgs } from "@remix-run/node";
import { Link, Outlet, useLoaderData } from "@remix-run/react";
import { json } from "@remix-run/node";
import { env } from "~/lib/env.server";
import { requireUserId } from "~/lib/session.server";
import { formatTimestamp } from "~/lib/utils/format";
import { getEndpointsForOrg } from "~/models/endpoint.server";
import { requireOrgMember } from "~/models/org.server";

export async function loader({ request, params }: LoaderFunctionArgs) {
  const userId = await requireUserId(request);
  const orgSlug = params.orgSlug;

  if (!orgSlug) {
    throw new Response("Not Found", { status: 404 });
  }

  const org = await requireOrgMember(userId, orgSlug);
  const endpoints = await getEndpointsForOrg(org.id);

  return json({
    org: { id: org.id, name: org.name, slug: org.slug },
    endpoints,
    appBaseUrl: env.APP_BASE_URL,
  });
}

export default function EndpointsRoute() {
  const { org, endpoints, appBaseUrl } = useLoaderData<typeof loader>();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">{org.name} endpoints</h1>
          <p className="text-sm text-slate-600">Create endpoint keys and inspect ingestion stats.</p>
        </div>
        <Link
          to={`/app/orgs/${org.slug}/endpoints/new`}
          className="rounded bg-slate-900 px-3 py-2 text-sm text-white"
        >
          New endpoint
        </Link>
      </div>

      {endpoints.length === 0 ? (
        <div className="rounded border bg-white p-6">
          <p className="text-slate-600">No endpoints yet.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded border bg-white">
          <table className="w-full min-w-[860px] text-sm">
            <thead className="bg-slate-50 text-left text-slate-600">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Ingestion URL</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Last request</th>
                <th className="px-4 py-3">Last 24h</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {endpoints.map((endpoint) => {
                const ingestionUrl = `${appBaseUrl}/i/${endpoint.key}`;

                return (
                  <tr key={endpoint.id} className="border-t align-top">
                    <td className="px-4 py-3 font-medium">{endpoint.name}</td>
                    <td className="px-4 py-3">
                      <div className="max-w-[360px] break-all text-slate-700">{ingestionUrl}</div>
                      <button
                        type="button"
                        className="mt-1 text-xs underline"
                        onClick={() => navigator.clipboard.writeText(ingestionUrl)}
                      >
                        Copy URL
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded px-2 py-1 text-xs ${
                          endpoint.isActive ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-700"
                        }`}
                      >
                        {endpoint.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {endpoint.lastRequestAt ? formatTimestamp(endpoint.lastRequestAt) : "-"}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{endpoint.last24hCount}</td>
                    <td className="px-4 py-3 text-right">
                      <Link to={`/app/orgs/${org.slug}/endpoints/${endpoint.id}`} className="underline">
                        Inbox
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Outlet />
    </div>
  );
}
