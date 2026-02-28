import type { LoaderFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { Link, useLoaderData } from "@remix-run/react";
import { Sparkline } from "~/components/monitoring/sparkline";
import { env } from "~/lib/env.server";
import { formatTimestamp } from "~/lib/utils/format";
import { requireUserId } from "~/lib/session.server";
import { listMonitorsForOrg } from "~/models/monitoring/monitor.server";
import { getUserOrgs } from "~/models/org.server";

export async function loader({ request }: LoaderFunctionArgs) {
  if (!env.ENABLE_MONITORS_UI) {
    throw new Response("Not Found", { status: 404 });
  }

  const userId = await requireUserId(request);
  const orgs = await getUserOrgs(userId);
  const org = orgs[0];

  if (!org) {
    throw redirect("/app/orgs/new");
  }

  const monitors = await listMonitorsForOrg(org.id);

  return json({
    org: { id: org.id, slug: org.slug, name: org.name },
    monitors,
    probeRuntimeEnabled: env.ENABLE_PROBE_SCHEDULER && env.ENABLE_PROBE_WORKER,
  });
}

export default function MonitorsIndexRoute() {
  const { org, monitors, probeRuntimeEnabled } = useLoaderData<typeof loader>();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Monitors</h1>
          <p className="text-sm text-slate-600">Synthetic URL checks for {org.name}</p>
        </div>
        <Link to="/app/monitors/new" className="rounded bg-slate-900 px-3 py-2 text-sm text-white">
          New monitor
        </Link>
      </div>

      {!probeRuntimeEnabled ? (
        <div className="rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Probing is disabled. Set <code>ENABLE_PROBE_SCHEDULER=true</code> and <code>ENABLE_PROBE_WORKER=true</code>
          , then restart the app.
        </div>
      ) : null}

      {monitors.length === 0 ? (
        <div className="rounded border bg-white p-6 text-slate-600">
          No monitors yet. Create your first monitor.
        </div>
      ) : (
        <div className="overflow-x-auto rounded border bg-white">
          <table className="w-full min-w-[980px] text-sm">
            <thead className="bg-slate-50 text-left text-slate-600">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Last check</th>
                <th className="px-4 py-3">p95 latency</th>
                <th className="px-4 py-3">Uptime (50)</th>
                <th className="px-4 py-3">Trend</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {monitors.map((monitor) => {
                const recent = [...monitor.probeRuns].reverse();
                const hasProbeData = recent.length > 0 || Boolean(monitor.state?.lastProbeRunId);
                const latencies = recent.map((run) => run.latencyMs ?? null);
                const okCount = recent.filter((run) => run.ok).length;
                const uptime = recent.length ? Math.round((okCount / recent.length) * 100) : 0;
                const displayStatus = hasProbeData ? (monitor.state?.currentStatus ?? "DEGRADED") : "NO_DATA";

                const numeric = recent.map((run) => run.latencyMs).filter((v): v is number => typeof v === "number").sort((a, b) => a - b);
                const p95 = numeric.length ? numeric[Math.floor(numeric.length * 0.95)] : null;

                return (
                  <tr key={monitor.id} className="border-t">
                    <td className="px-4 py-3">
                      <div className="font-medium">{monitor.name}</div>
                      <div className="text-xs text-slate-500 break-all">{monitor.url}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded px-2 py-1 text-xs ${
                          displayStatus === "UP"
                            ? "bg-emerald-100 text-emerald-700"
                            : displayStatus === "DEGRADED"
                              ? "bg-amber-100 text-amber-700"
                              : displayStatus === "NO_DATA"
                                ? "bg-slate-100 text-slate-700"
                                : "bg-red-100 text-red-700"
                        }`}
                      >
                        {displayStatus}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{recent[recent.length - 1] ? formatTimestamp(recent[recent.length - 1].startedAt) : "-"}</td>
                    <td className="px-4 py-3 text-slate-600">{p95 != null ? `${p95}ms` : "-"}</td>
                    <td className="px-4 py-3 text-slate-600">{uptime}%</td>
                    <td className="px-4 py-3">
                      <Sparkline values={latencies} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link to={`/app/monitors/${monitor.id}`} className="underline">
                        Open
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
