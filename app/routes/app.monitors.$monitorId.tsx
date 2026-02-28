import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { Form, Link, useLoaderData } from "@remix-run/react";
import { Timeline } from "~/components/monitoring/timeline";
import { env } from "~/lib/env.server";
import { formatTimestamp } from "~/lib/utils/format";
import { requireUserId } from "~/lib/session.server";
import { listAlertRulesForMonitor } from "~/models/monitoring/alert.server";
import { listIncidentsForMonitor } from "~/models/monitoring/incident.server";
import { getMonitorForOrg, updateMonitorForOrg } from "~/models/monitoring/monitor.server";
import { getMonitorProbeRuns } from "~/models/monitoring/probe-run.server";
import { getUserOrgs } from "~/models/org.server";

export async function loader({ request, params }: LoaderFunctionArgs) {
  if (!env.ENABLE_MONITORS_UI) throw new Response("Not Found", { status: 404 });

  const userId = await requireUserId(request);
  const orgs = await getUserOrgs(userId);
  const org = orgs[0];
  if (!org) throw redirect("/app/orgs/new");

  const monitorId = params.monitorId;
  if (!monitorId) throw new Response("Not Found", { status: 404 });

  const monitor = await getMonitorForOrg(org.id, monitorId);
  if (!monitor) throw new Response("Not Found", { status: 404 });

  const [runs, incidents, rules] = await Promise.all([
    getMonitorProbeRuns(monitor.id, 100),
    listIncidentsForMonitor(monitor.id, 50),
    listAlertRulesForMonitor(monitor.id),
  ]);

  return json({
    org,
    monitor,
    runs,
    incidents,
    rules,
    probeRuntimeEnabled: env.ENABLE_PROBE_SCHEDULER && env.ENABLE_PROBE_WORKER,
  });
}

export async function action({ request, params }: ActionFunctionArgs) {
  const userId = await requireUserId(request);
  const orgs = await getUserOrgs(userId);
  const org = orgs[0];
  if (!org) throw redirect("/app/orgs/new");

  const monitorId = params.monitorId;
  if (!monitorId) throw new Response("Not Found", { status: 404 });

  const formData = await request.formData();
  const isActive = formData.get("isActive") === "on";

  await updateMonitorForOrg(org.id, monitorId, { isActive });
  return json({ ok: true });
}

export default function MonitorDetailRoute() {
  const { monitor, runs, incidents, rules, probeRuntimeEnabled } = useLoaderData<typeof loader>();
  const hasProbeData = runs.length > 0 || Boolean(monitor.state?.lastProbeRunId);
  const displayStatus = hasProbeData ? (monitor.state?.currentStatus ?? "DEGRADED") : "NO_DATA";

  return (
    <div className="space-y-4">
      {!probeRuntimeEnabled ? (
        <section className="rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Probing is disabled. Set <code>ENABLE_PROBE_SCHEDULER=true</code> and <code>ENABLE_PROBE_WORKER=true</code>,
          then restart the app.
        </section>
      ) : null}

      <section className="rounded border bg-white p-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold">{monitor.name}</h1>
            <p className="text-sm text-slate-600 break-all">{monitor.method} {monitor.url}</p>
          </div>
          <Form method="post" className="flex items-center gap-2 text-sm">
            <label className="flex items-center gap-2">
              <input type="checkbox" name="isActive" defaultChecked={monitor.isActive} /> Active
            </label>
            <button type="submit" className="rounded border px-3 py-1.5">Save</button>
          </Form>
        </div>
        <div className="mt-3 text-sm text-slate-600">
          Current status: <span className="font-medium">{displayStatus}</span>
        </div>
      </section>

      <section className="rounded border bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold">Timeline (recent 100 probes)</h2>
        <Timeline
          points={runs
            .slice()
            .reverse()
            .map((run) => ({ ok: run.ok, latencyMs: run.latencyMs, startedAt: run.startedAt }))}
        />
      </section>

      <section className="rounded border bg-white p-4">
        <h2 className="text-sm font-semibold">Recent probe runs</h2>
        {runs.length === 0 ? (
          <p className="mt-2 text-sm text-slate-600">No probe runs yet.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[860px] text-sm">
              <thead className="bg-slate-50 text-left text-slate-600">
                <tr>
                  <th className="px-3 py-2">Time</th>
                  <th className="px-3 py-2">Result</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Latency</th>
                  <th className="px-3 py-2">Reason</th>
                  <th className="px-3 py-2">Error</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((run) => (
                  <tr key={run.id} className="border-t">
                    <td className="px-3 py-2 text-slate-600">{formatTimestamp(run.startedAt)}</td>
                    <td className="px-3 py-2">
                      <span className={`rounded px-2 py-1 text-xs ${run.ok ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
                        {run.ok ? "UP" : "DOWN"}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-slate-600">{run.statusCode ?? "-"}</td>
                    <td className="px-3 py-2 text-slate-600">{run.latencyMs != null ? `${run.latencyMs}ms` : "-"}</td>
                    <td className="px-3 py-2 text-slate-600">{run.failureReason}</td>
                    <td className="px-3 py-2 text-slate-600 text-xs">{run.errorMessage ?? "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded border bg-white p-4">
        <h2 className="text-sm font-semibold">Incidents</h2>
        {incidents.length === 0 ? <p className="mt-2 text-sm text-slate-600">No incidents yet.</p> : (
          <ul className="mt-2 space-y-2 text-sm">
            {incidents.map((incident) => (
              <li key={incident.id} className="rounded border p-2">
                <div className="font-medium">{incident.status} - {incident.openReason}</div>
                <div className="text-slate-600">Opened {formatTimestamp(incident.openedAt)}</div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded border bg-white p-4">
        <h2 className="text-sm font-semibold">Alert rules</h2>
        {rules.length === 0 ? <p className="mt-2 text-sm text-slate-600">No rules configured.</p> : (
          <ul className="mt-2 space-y-1 text-sm">
            {rules.map((rule) => (
              <li key={rule.id} className="text-slate-700">{rule.ruleType} ({rule.enabled ? "enabled" : "disabled"})</li>
            ))}
          </ul>
        )}
      </section>

      <div>
        <Link to="/app/monitors" className="text-sm underline">Back to monitors</Link>
      </div>
    </div>
  );
}
