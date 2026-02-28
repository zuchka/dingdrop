import type { LoaderFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { Form, Link, useLoaderData, useSearchParams } from "@remix-run/react";
import type { IncidentSeverity, IncidentStatus } from "@prisma/client";
import { env } from "~/lib/env.server";
import { formatTimestamp } from "~/lib/utils/format";
import { requireUserId } from "~/lib/session.server";
import { getIncidentsWithPagination } from "~/models/monitoring/incident.server";
import { listMonitorsForOrg } from "~/models/monitoring/monitor.server";
import { getUserOrgs } from "~/models/org.server";

export async function loader({ request }: LoaderFunctionArgs) {
  if (!env.ENABLE_MONITORS_UI) throw new Response("Not Found", { status: 404 });

  const userId = await requireUserId(request);
  const orgs = await getUserOrgs(userId);
  const org = orgs[0];
  if (!org) throw redirect("/app");

  // Parse URL search params for filtering and pagination
  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get("page") || "1", 10);
  const pageSize = 20;
  const status = url.searchParams.get("status") as IncidentStatus | null;
  const severity = url.searchParams.get("severity") as IncidentSeverity | null;
  const monitorId = url.searchParams.get("monitorId") || undefined;
  const startDate = url.searchParams.get("startDate")
    ? new Date(url.searchParams.get("startDate")!)
    : undefined;
  const endDate = url.searchParams.get("endDate") ? new Date(url.searchParams.get("endDate")!) : undefined;

  const [paginatedResult, monitors] = await Promise.all([
    getIncidentsWithPagination({
      orgId: org.id,
      page,
      pageSize,
      filters: {
        status: status || undefined,
        severity: severity || undefined,
        monitorId,
        startDate,
        endDate,
      },
    }),
    listMonitorsForOrg(org.id),
  ]);

  return json({
    incidents: paginatedResult.incidents,
    totalCount: paginatedResult.totalCount,
    page: paginatedResult.page,
    totalPages: paginatedResult.totalPages,
    pageSize: paginatedResult.pageSize,
    monitors: monitors.map((m) => ({ id: m.id, name: m.name })),
  });
}

export default function IncidentsRoute() {
  const { incidents, totalCount, page, totalPages, monitors } = useLoaderData<typeof loader>();
  const [searchParams] = useSearchParams();

  const currentStatus = searchParams.get("status") || "";
  const currentSeverity = searchParams.get("severity") || "";
  const currentMonitorId = searchParams.get("monitorId") || "";

  const hasActiveFilters = currentStatus || currentSeverity || currentMonitorId;

  const calculateDuration = (openedAt: string, resolvedAt: string | null) => {
    if (!resolvedAt) return null;
    const start = new Date(openedAt).getTime();
    const end = new Date(resolvedAt).getTime();
    const durationMinutes = Math.round((end - start) / 1000 / 60);
    
    if (durationMinutes < 60) return `${durationMinutes}m`;
    const hours = Math.floor(durationMinutes / 60);
    const mins = durationMinutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  return (
    <section className="space-y-4">
      <div className="rounded border bg-white p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold">Incidents</h1>
            <p className="mt-1 text-sm text-slate-600">
              View and manage incidents triggered by alert rules.
            </p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="rounded border bg-white p-4">
        <Form method="get" className="grid gap-4 md:grid-cols-4">
          <div>
            <label htmlFor="status" className="mb-1 block text-sm font-medium">
              Status
            </label>
            <select
              id="status"
              name="status"
              defaultValue={currentStatus}
              className="w-full rounded border px-3 py-2 text-sm"
            >
              <option value="">All statuses</option>
              <option value="OPEN">Open</option>
              <option value="RESOLVED">Resolved</option>
            </select>
          </div>

          <div>
            <label htmlFor="severity" className="mb-1 block text-sm font-medium">
              Severity
            </label>
            <select
              id="severity"
              name="severity"
              defaultValue={currentSeverity}
              className="w-full rounded border px-3 py-2 text-sm"
            >
              <option value="">All severities</option>
              <option value="CRITICAL">Critical</option>
              <option value="WARNING">Warning</option>
            </select>
          </div>

          <div>
            <label htmlFor="monitorId" className="mb-1 block text-sm font-medium">
              Monitor
            </label>
            <select
              id="monitorId"
              name="monitorId"
              defaultValue={currentMonitorId}
              className="w-full rounded border px-3 py-2 text-sm"
            >
              <option value="">All monitors</option>
              {monitors.map((monitor) => (
                <option key={monitor.id} value={monitor.id}>
                  {monitor.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-end gap-2">
            <button
              type="submit"
              className="rounded bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-800"
            >
              Apply filters
            </button>
            {hasActiveFilters && (
              <a href="?" className="rounded border px-4 py-2 text-sm hover:bg-slate-50">
                Clear
              </a>
            )}
          </div>
        </Form>

        {hasActiveFilters && (
          <div className="mt-3 flex flex-wrap gap-2 border-t pt-3">
            <span className="text-sm text-slate-600">Active filters:</span>
            {currentStatus && (
              <span className="rounded bg-slate-100 px-2 py-1 text-xs">Status: {currentStatus}</span>
            )}
            {currentSeverity && (
              <span className="rounded bg-slate-100 px-2 py-1 text-xs">
                Severity: {currentSeverity}
              </span>
            )}
            {currentMonitorId && (
              <span className="rounded bg-slate-100 px-2 py-1 text-xs">
                Monitor: {monitors.find((m) => m.id === currentMonitorId)?.name || "Selected"}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Incidents table */}
      {incidents.length === 0 ? (
        <div className="rounded border bg-white p-6">
          {hasActiveFilters ? (
            <>
              <p className="text-slate-600">No incidents match your filters.</p>
              <a href="/app/incidents" className="mt-2 inline-block text-sm text-slate-600 underline">
                Clear filters
              </a>
            </>
          ) : (
            <p className="text-slate-600">No incidents yet. Incidents will appear here when alerts are triggered.</p>
          )}
        </div>
      ) : (
        <>
          <div className="overflow-x-auto rounded border bg-white">
            <table className="w-full text-sm">
              <thead className="border-b bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Monitor</th>
                  <th className="px-4 py-3 text-left font-medium">Severity</th>
                  <th className="px-4 py-3 text-left font-medium">Status</th>
                  <th className="px-4 py-3 text-left font-medium">Opened</th>
                  <th className="px-4 py-3 text-left font-medium">Resolved</th>
                  <th className="px-4 py-3 text-left font-medium">Duration</th>
                  <th className="px-4 py-3 text-left font-medium">Notifications</th>
                  <th className="px-4 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {incidents.map((incident) => {
                  const duration = calculateDuration(incident.openedAt, incident.resolvedAt);

                  return (
                    <tr key={incident.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <Link
                          to={`/app/monitors/${incident.monitor.id}`}
                          className="font-medium hover:underline"
                        >
                          {incident.monitor.name}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded px-2 py-0.5 text-xs font-medium ${
                            incident.severity === "CRITICAL"
                              ? "bg-red-100 text-red-700"
                              : "bg-amber-100 text-amber-700"
                          }`}
                        >
                          {incident.severity}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded px-2 py-0.5 text-xs font-medium ${
                            incident.status === "OPEN"
                              ? "bg-red-100 text-red-700"
                              : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {incident.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {formatTimestamp(incident.openedAt)}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {incident.resolvedAt ? formatTimestamp(incident.resolvedAt) : "—"}
                      </td>
                      <td className="px-4 py-3 text-slate-600">{duration || "—"}</td>
                      <td className="px-4 py-3 text-slate-600">
                        {incident._count.events} event{incident._count.events === 1 ? "" : "s"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          to={`/app/incidents/${incident.id}`}
                          className="rounded border px-3 py-1.5 text-sm hover:bg-slate-50"
                        >
                          View
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between rounded border bg-white p-4">
              <div className="text-sm text-slate-600">
                Showing page {page} of {totalPages} ({totalCount} total)
              </div>
              <div className="flex gap-2">
                {page > 1 && (
                  <a
                    href={`?${new URLSearchParams({
                      ...Object.fromEntries(searchParams),
                      page: String(page - 1),
                    }).toString()}`}
                    className="rounded border px-3 py-1.5 text-sm hover:bg-slate-50"
                  >
                    Previous
                  </a>
                )}
                {page < totalPages && (
                  <a
                    href={`?${new URLSearchParams({
                      ...Object.fromEntries(searchParams),
                      page: String(page + 1),
                    }).toString()}`}
                    className="rounded border px-3 py-1.5 text-sm hover:bg-slate-50"
                  >
                    Next
                  </a>
                )}
              </div>
            </div>
          )}

          {totalPages <= 1 && (
            <div className="text-sm text-slate-600">
              Showing {incidents.length} of {totalCount} incident{totalCount === 1 ? "" : "s"}
            </div>
          )}
        </>
      )}
    </section>
  );
}
