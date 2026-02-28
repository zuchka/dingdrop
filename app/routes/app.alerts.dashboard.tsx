import type { LoaderFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { Link, useLoaderData } from "@remix-run/react";
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, ResponsiveContainer } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "~/components/ui/chart";
import { env } from "~/lib/env.server";
import { formatTimestamp } from "~/lib/utils/format";
import { requireUserId } from "~/lib/session.server";
import {
  getAlertDashboardMetrics,
  getIncidentTrendData,
  getNotificationHealthMetrics,
} from "~/models/monitoring/alert-metrics.server";
import { getIncidentsWithPagination } from "~/models/monitoring/incident.server";
import { getUserOrgs } from "~/models/org.server";

export async function loader({ request }: LoaderFunctionArgs) {
  if (!env.ENABLE_MONITORS_UI) throw new Response("Not Found", { status: 404 });

  const userId = await requireUserId(request);
  const orgs = await getUserOrgs(userId);
  const org = orgs[0];
  if (!org) throw redirect("/app");

  const url = new URL(request.url);
  const timeRange = parseInt(url.searchParams.get("timeRange") || "7", 10);

  const [dashboardMetrics, trendData, notificationHealth, recentIncidents] = await Promise.all([
    getAlertDashboardMetrics({ orgId: org.id, timeRange }),
    getIncidentTrendData({ orgId: org.id, timeRange: 30 }),
    getNotificationHealthMetrics({ orgId: org.id, timeRange }),
    getIncidentsWithPagination({
      orgId: org.id,
      page: 1,
      pageSize: 10,
      filters: { status: "OPEN" },
    }),
  ]);

  return json({
    dashboardMetrics,
    trendData,
    notificationHealth,
    recentIncidents: recentIncidents.incidents,
  });
}

export default function AlertsDashboardRoute() {
  const { dashboardMetrics, trendData, notificationHealth, recentIncidents } =
    useLoaderData<typeof loader>();

  return (
    <section className="space-y-4">
      {/* Header */}
      <div className="rounded border bg-white p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold">Alerts dashboard</h1>
            <p className="mt-1 text-sm text-slate-600">
              Overview of alerting activity and notification health.
            </p>
          </div>
          <div className="flex gap-2">
            <Link
              to="/app/alerts"
              className="rounded border px-4 py-2 text-sm hover:bg-slate-50"
            >
              View all rules
            </Link>
            <Link
              to="/app/alerts/new"
              className="rounded bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-800"
            >
              Create rule
            </Link>
          </div>
        </div>
      </div>

      {/* Key metrics */}
      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded border bg-white p-4">
          <div className="text-sm text-slate-600">Active incidents</div>
          <div className="mt-2 text-3xl font-semibold text-red-600">
            {dashboardMetrics.activeIncidents}
          </div>
          <Link to="/app/incidents?status=OPEN" className="mt-2 block text-xs text-slate-500 hover:underline">
            View all →
          </Link>
        </div>

        <div className="rounded border bg-white p-4">
          <div className="text-sm text-slate-600">Recent incidents (7d)</div>
          <div className="mt-2 text-3xl font-semibold">{dashboardMetrics.totalRecentIncidents}</div>
          <div className="mt-2 flex gap-3 text-xs">
            <span className="text-red-600">
              {dashboardMetrics.criticalIncidents} critical
            </span>
            <span className="text-amber-600">
              {dashboardMetrics.warningIncidents} warning
            </span>
          </div>
        </div>

        <div className="rounded border bg-white p-4">
          <div className="text-sm text-slate-600">Notifications sent (7d)</div>
          <div className="mt-2 text-3xl font-semibold">{dashboardMetrics.notifications.sent}</div>
          <div className="mt-2 text-xs text-slate-500">
            {dashboardMetrics.notifications.total} total
          </div>
        </div>

        <div className="rounded border bg-white p-4">
          <div className="text-sm text-slate-600">Notification success rate</div>
          <div className="mt-2 text-3xl font-semibold">
            {dashboardMetrics.notifications.successRate}%
          </div>
          <div className="mt-2 text-xs text-red-600">
            {dashboardMetrics.notifications.failed} failed
          </div>
        </div>
      </div>

      {/* Incident trend chart */}
      <div className="rounded border bg-white p-6">
        <h2 className="text-sm font-semibold">Incident trend (30 days)</h2>
        {trendData.trendData.length === 0 ? (
          <p className="mt-4 text-sm text-slate-600">No incident data for the selected period.</p>
        ) : (
          <div className="mt-4">
            <ChartContainer className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendData.trendData}>
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 12 }}
                    tickFormatter={(value) => {
                      const date = new Date(value);
                      return `${date.getMonth() + 1}/${date.getDate()}`;
                    }}
                  />
                  <YAxis tick={{ fontSize: 12 }} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Area
                    type="monotone"
                    dataKey="critical"
                    stackId="1"
                    stroke="#dc2626"
                    fill="#dc2626"
                    name="Critical"
                  />
                  <Area
                    type="monotone"
                    dataKey="warning"
                    stackId="1"
                    stroke="#d97706"
                    fill="#d97706"
                    name="Warning"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </ChartContainer>
          </div>
        )}
      </div>

      {/* Two columns: Top monitors & Channel health */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Top alerting monitors */}
        <div className="rounded border bg-white p-6">
          <h2 className="text-sm font-semibold">Top alerting monitors (7d)</h2>
          {dashboardMetrics.topMonitors.length === 0 ? (
            <p className="mt-4 text-sm text-slate-600">No incidents in the selected period.</p>
          ) : (
            <div className="mt-4 space-y-3">
              {dashboardMetrics.topMonitors.map((monitor) => (
                <div key={monitor.monitorId} className="flex items-center justify-between">
                  <Link
                    to={`/app/monitors/${monitor.monitorId}`}
                    className="flex-1 truncate text-sm hover:underline"
                  >
                    {monitor.name}
                  </Link>
                  <span className="ml-3 rounded bg-slate-100 px-2 py-1 text-xs font-medium">
                    {monitor.count} incident{monitor.count === 1 ? "" : "s"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Notification channel health */}
        <div className="rounded border bg-white p-6">
          <h2 className="text-sm font-semibold">Notification channel health (7d)</h2>
          {notificationHealth.channelMetrics.length === 0 ? (
            <p className="mt-4 text-sm text-slate-600">No notifications sent in the selected period.</p>
          ) : (
            <div className="mt-4 space-y-3">
              {notificationHealth.channelMetrics.map((channel) => (
                <div key={channel.channelId} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{channel.name}</span>
                    <span className="text-slate-600">{channel.successRate}% success</span>
                  </div>
                  <div className="flex h-2 overflow-hidden rounded bg-slate-100">
                    <div
                      className="bg-emerald-500"
                      style={{ width: `${(channel.sent / channel.total) * 100}%` }}
                    />
                    <div
                      className="bg-red-500"
                      style={{ width: `${(channel.failed / channel.total) * 100}%` }}
                    />
                  </div>
                  <div className="flex gap-3 text-xs text-slate-600">
                    <span>{channel.sent} sent</span>
                    <span>{channel.failed} failed</span>
                    {channel.pending > 0 && <span>{channel.pending} pending</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Active incidents table */}
      <div className="rounded border bg-white p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Active incidents</h2>
          <Link to="/app/incidents?status=OPEN" className="text-sm text-slate-600 hover:underline">
            View all →
          </Link>
        </div>

        {recentIncidents.length === 0 ? (
          <p className="mt-4 text-sm text-slate-600">No active incidents. All systems operational! 🎉</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b text-left">
                <tr>
                  <th className="pb-2 pr-4">Monitor</th>
                  <th className="pb-2 pr-4">Severity</th>
                  <th className="pb-2 pr-4">Opened</th>
                  <th className="pb-2">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {recentIncidents.map((incident) => (
                  <tr key={incident.id}>
                    <td className="py-3 pr-4">
                      <Link
                        to={`/app/monitors/${incident.monitor.id}`}
                        className="font-medium hover:underline"
                      >
                        {incident.monitor.name}
                      </Link>
                    </td>
                    <td className="py-3 pr-4">
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
                    <td className="py-3 pr-4 text-slate-600">
                      {formatTimestamp(incident.openedAt)}
                    </td>
                    <td className="py-3">
                      <Link
                        to={`/app/incidents/${incident.id}`}
                        className="rounded border px-3 py-1.5 text-sm hover:bg-slate-50"
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
    </section>
  );
}
