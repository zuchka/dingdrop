import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { Form, useActionData, useFetcher, useLoaderData, useSearchParams } from "@remix-run/react";
import type { AlertRuleType, IncidentSeverity } from "@prisma/client";
import { AlertRuleForm } from "~/components/alerts/alert-rule-form";
import { env } from "~/lib/env.server";
import { formatTimestamp } from "~/lib/utils/format";
import { requireUserId } from "~/lib/session.server";
import {
  deleteAlertRule,
  getAlertRuleWithStats,
  replaceAlertRuleSubscriptions,
  updateAlertRule,
  updateAlertRuleConfig,
} from "~/models/monitoring/alert.server";
import { listChannelsForOrg } from "~/models/monitoring/channel.server";
import { listMonitorsForOrg } from "~/models/monitoring/monitor.server";
import { getUserOrgs } from "~/models/org.server";

export async function loader({ request, params }: LoaderFunctionArgs) {
  if (!env.ENABLE_MONITORS_UI) throw new Response("Not Found", { status: 404 });

  const userId = await requireUserId(request);
  const orgs = await getUserOrgs(userId);
  const org = orgs[0];
  if (!org) throw redirect("/app");

  const alertId = params.alertId;
  if (!alertId) throw new Response("Not Found", { status: 404 });

  const [alertWithStats, channels, monitors] = await Promise.all([
    getAlertRuleWithStats({ ruleId: alertId, orgId: org.id }),
    listChannelsForOrg(org.id),
    listMonitorsForOrg(org.id),
  ]);

  if (!alertWithStats) throw new Response("Not Found", { status: 404 });

  return json({
    alert: alertWithStats,
    channels,
    monitors: monitors.map((m) => ({ id: m.id, name: m.name })),
  });
}

export async function action({ request, params }: ActionFunctionArgs) {
  if (!env.ENABLE_MONITORS_UI) throw new Response("Not Found", { status: 404 });

  const userId = await requireUserId(request);
  const orgs = await getUserOrgs(userId);
  const org = orgs[0];
  if (!org) return json({ error: "No organization found." }, { status: 400 });

  const alertId = params.alertId;
  if (!alertId) throw new Response("Not Found", { status: 404 });

  const formData = await request.formData();
  const intent = String(formData.get("intent") ?? "").trim();

  try {
    if (intent === "delete") {
      await deleteAlertRule({ ruleId: alertId, orgId: org.id });
      throw redirect("/app/alerts");
    }

    if (intent === "toggle") {
      const enabled = formData.get("enabled") === "true";
      const alert = await getAlertRuleWithStats({ ruleId: alertId, orgId: org.id });
      if (!alert) return json({ error: "Alert rule not found." }, { status: 404 });

      await updateAlertRule({
        monitorId: alert.monitorId,
        ruleId: alertId,
        enabled,
      });
      return json({ ok: true });
    }

    if (intent === "update") {
      const ruleType = String(formData.get("ruleType") ?? "").trim() as AlertRuleType;
      const severity = String(formData.get("severity") ?? "CRITICAL").trim() as IncidentSeverity;
      const thresholdInt = formData.get("thresholdInt") ? Number(formData.get("thresholdInt")) : null;
      const thresholdText = formData.get("thresholdText")
        ? String(formData.get("thresholdText")).trim()
        : null;
      const channelIds = formData.getAll("channelIds").map((id) => String(id));

      // Validate type-specific thresholds
      if (ruleType === "LATENCY" && (!thresholdInt || thresholdInt < 1)) {
        return json({ error: "Latency threshold must be at least 1 millisecond." }, { status: 400 });
      }

      if (ruleType === "TLS_EXPIRY" && (!thresholdInt || thresholdInt < 1)) {
        return json({ error: "TLS expiry threshold must be at least 1 day." }, { status: 400 });
      }

      if (ruleType === "BODY_MISMATCH" && !thresholdText) {
        return json({ error: "Body pattern is required for body mismatch rules." }, { status: 400 });
      }

      await updateAlertRuleConfig({
        ruleId: alertId,
        orgId: org.id,
        ruleType,
        severity,
        thresholdInt,
        thresholdText,
      });

      await replaceAlertRuleSubscriptions({ ruleId: alertId, channelIds });

      throw redirect(`/app/alerts/${alertId}`);
    }

    return json({ error: "Invalid action." }, { status: 400 });
  } catch (err) {
    if (err instanceof Response) throw err;
    const errorMessage = err instanceof Error ? err.message : "Action failed.";
    return json({ error: errorMessage }, { status: 400 });
  }
}

export default function AlertDetailRoute() {
  const { alert, channels, monitors } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const [searchParams] = useSearchParams();
  const editMode = searchParams.get("edit") === "true";
  const toggleFetcher = useFetcher();

  const isToggling = toggleFetcher.state !== "idle" && toggleFetcher.formData?.get("intent") === "toggle";
  const optimisticEnabled = isToggling
    ? toggleFetcher.formData?.get("enabled") === "true"
    : alert.enabled;

  const getThresholdDisplay = () => {
    switch (alert.ruleType) {
      case "DOWN":
        return "Triggers on consecutive failures";
      case "LATENCY":
        return `${alert.thresholdInt}ms`;
      case "TLS_EXPIRY":
        return `${alert.thresholdInt} days`;
      case "BODY_MISMATCH":
        return alert.thresholdText || "N/A";
      default:
        return "N/A";
    }
  };

  if (editMode) {
    return (
      <section className="rounded border bg-white p-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold">Edit alert rule</h1>
            <p className="mt-1 text-sm text-slate-600">{alert.monitor.name}</p>
          </div>
          <a href={`/app/alerts/${alert.id}`} className="rounded border px-3 py-1.5 text-sm">
            Cancel
          </a>
        </div>

        <AlertRuleForm
          monitors={monitors}
          channels={channels}
          defaultValues={{
            monitorId: alert.monitorId,
            ruleType: alert.ruleType,
            severity: alert.severity,
            thresholdInt: alert.thresholdInt,
            thresholdText: alert.thresholdText,
            channelIds: alert.subscriptions.map((s) => s.channelId),
          }}
          error={actionData?.error}
          submitLabel="Update alert rule"
          isEdit={true}
        />
      </section>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <section className="rounded border bg-white p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-semibold">{alert.ruleType} Alert</h1>
              <span
                className={`rounded px-2 py-0.5 text-xs font-medium ${
                  alert.severity === "CRITICAL"
                    ? "bg-red-100 text-red-700"
                    : "bg-amber-100 text-amber-700"
                }`}
              >
                {alert.severity}
              </span>
              <span
                className={`rounded px-2 py-0.5 text-xs font-medium ${
                  optimisticEnabled ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"
                }`}
              >
                {optimisticEnabled ? "Enabled" : "Disabled"}
              </span>
            </div>
            <p className="mt-2 text-sm text-slate-600">
              Monitor: <a href={`/app/monitors/${alert.monitor.id}`} className="underline">{alert.monitor.name}</a>
            </p>
            <p className="text-sm text-slate-600">
              URL: <span className="break-all">{alert.monitor.url}</span>
            </p>
          </div>

          <div className="flex gap-2">
            <a
              href={`/app/alerts/${alert.id}?edit=true`}
              className="rounded border px-3 py-1.5 text-sm"
            >
              Edit
            </a>
            <toggleFetcher.Form method="post">
              <input type="hidden" name="intent" value="toggle" />
              <input type="hidden" name="enabled" value={optimisticEnabled ? "false" : "true"} />
              <button
                type="submit"
                disabled={isToggling}
                className="rounded border px-3 py-1.5 text-sm disabled:opacity-50"
              >
                {isToggling ? "..." : optimisticEnabled ? "Disable" : "Enable"}
              </button>
            </toggleFetcher.Form>
            <Form
              method="post"
              onSubmit={(e) => {
                if (!confirm("Are you sure you want to delete this alert rule?")) {
                  e.preventDefault();
                }
              }}
            >
              <input type="hidden" name="intent" value="delete" />
              <button type="submit" className="rounded border border-red-300 px-3 py-1.5 text-sm text-red-600">
                Delete
              </button>
            </Form>
          </div>
        </div>
      </section>

      {/* Configuration */}
      <section className="rounded border bg-white p-6">
        <h2 className="text-sm font-semibold">Configuration</h2>
        <dl className="mt-4 grid gap-3 md:grid-cols-2">
          <div>
            <dt className="text-sm text-slate-600">Rule type</dt>
            <dd className="mt-1 font-medium">{alert.ruleType}</dd>
          </div>
          <div>
            <dt className="text-sm text-slate-600">Severity</dt>
            <dd className="mt-1 font-medium">{alert.severity}</dd>
          </div>
          <div>
            <dt className="text-sm text-slate-600">Threshold</dt>
            <dd className="mt-1 font-medium">{getThresholdDisplay()}</dd>
          </div>
          <div>
            <dt className="text-sm text-slate-600">Created</dt>
            <dd className="mt-1 font-medium">{formatTimestamp(alert.createdAt)}</dd>
          </div>
        </dl>
      </section>

      {/* Stats */}
      <section className="rounded border bg-white p-6">
        <h2 className="text-sm font-semibold">Statistics</h2>
        <dl className="mt-4 grid gap-3 md:grid-cols-3">
          <div>
            <dt className="text-sm text-slate-600">Total incidents</dt>
            <dd className="mt-1 text-2xl font-semibold">{alert.stats.incidentCount}</dd>
          </div>
          <div>
            <dt className="text-sm text-slate-600">Open incidents</dt>
            <dd className="mt-1 text-2xl font-semibold text-red-600">{alert.stats.openIncidentCount}</dd>
          </div>
          <div>
            <dt className="text-sm text-slate-600">Last fired</dt>
            <dd className="mt-1 text-sm font-medium">
              {alert.stats.lastFired ? formatTimestamp(alert.stats.lastFired) : "Never"}
            </dd>
          </div>
        </dl>
      </section>

      {/* Notification channels */}
      <section className="rounded border bg-white p-6">
        <h2 className="text-sm font-semibold">Notification channels</h2>
        {alert.subscriptions.length === 0 ? (
          <p className="mt-3 text-sm text-slate-600">
            No channels configured. <a href={`/app/alerts/${alert.id}?edit=true`} className="underline">Edit</a> to add
            channels.
          </p>
        ) : (
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            {alert.subscriptions.map((sub) => (
              <div key={sub.id} className="rounded border p-3">
                <div className="font-medium">{sub.channel.name}</div>
                <div className="text-sm text-slate-600">{sub.channel.type}</div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Recent incidents */}
      <section className="rounded border bg-white p-6">
        <h2 className="text-sm font-semibold">Recent incidents</h2>
        {alert.incidents.length === 0 ? (
          <p className="mt-3 text-sm text-slate-600">No incidents yet.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b text-left">
                <tr>
                  <th className="pb-2 pr-4">Status</th>
                  <th className="pb-2 pr-4">Severity</th>
                  <th className="pb-2 pr-4">Opened</th>
                  <th className="pb-2 pr-4">Resolved</th>
                  <th className="pb-2">Duration</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {alert.incidents.map((incident) => {
                  const duration =
                    incident.resolvedAt && incident.openedAt
                      ? Math.round(
                          (new Date(incident.resolvedAt).getTime() -
                            new Date(incident.openedAt).getTime()) /
                            1000 /
                            60
                        )
                      : null;

                  return (
                    <tr key={incident.id}>
                      <td className="py-2 pr-4">
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
                      <td className="py-2 pr-4">
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
                      <td className="py-2 pr-4">{formatTimestamp(incident.openedAt)}</td>
                      <td className="py-2 pr-4">
                        {incident.resolvedAt ? formatTimestamp(incident.resolvedAt) : "—"}
                      </td>
                      <td className="py-2">{duration ? `${duration}m` : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {alert.stats.incidentCount > 10 && (
          <p className="mt-3 text-sm text-slate-600">
            Showing 10 most recent incidents of {alert.stats.incidentCount} total.
          </p>
        )}
      </section>

      {actionData?.error && (
        <div className="rounded bg-red-50 p-4 text-sm text-red-600">{actionData.error}</div>
      )}
    </div>
  );
}
