import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { Form, Link, useActionData, useLoaderData } from "@remix-run/react";
import { env } from "~/lib/env.server";
import { formatTimestamp } from "~/lib/utils/format";
import { requireUserId } from "~/lib/session.server";
import { getIncidentWithDetails, manuallyResolveIncident } from "~/models/monitoring/incident.server";
import { getUserOrgs } from "~/models/org.server";

export async function loader({ request, params }: LoaderFunctionArgs) {
  if (!env.ENABLE_MONITORS_UI) throw new Response("Not Found", { status: 404 });

  const userId = await requireUserId(request);
  const orgs = await getUserOrgs(userId);
  const org = orgs[0];
  if (!org) throw redirect("/app");

  const incidentId = params.incidentId;
  if (!incidentId) throw new Response("Not Found", { status: 404 });

  const incident = await getIncidentWithDetails({ incidentId, orgId: org.id });
  if (!incident) throw new Response("Not Found", { status: 404 });

  return json({ incident, userId });
}

export async function action({ request, params }: ActionFunctionArgs) {
  if (!env.ENABLE_MONITORS_UI) throw new Response("Not Found", { status: 404 });

  const userId = await requireUserId(request);
  const orgs = await getUserOrgs(userId);
  const org = orgs[0];
  if (!org) return json({ error: "No organization found." }, { status: 400 });

  const incidentId = params.incidentId;
  if (!incidentId) throw new Response("Not Found", { status: 404 });

  const formData = await request.formData();
  const intent = String(formData.get("intent") ?? "").trim();

  if (intent === "resolve") {
    const reason = String(formData.get("reason") ?? "").trim();
    
    if (!reason) {
      return json({ error: "Resolution reason is required." }, { status: 400 });
    }

    try {
      await manuallyResolveIncident({
        incidentId,
        orgId: org.id,
        userId,
        reason,
      });
      return json({ success: true, message: "Incident resolved successfully." });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to resolve incident.";
      return json({ error: errorMessage }, { status: 400 });
    }
  }

  return json({ error: "Invalid action." }, { status: 400 });
}

export default function IncidentDetailRoute() {
  const { incident } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();

  const calculateDuration = () => {
    if (!incident.resolvedAt) return null;
    const start = new Date(incident.openedAt).getTime();
    const end = new Date(incident.resolvedAt).getTime();
    const durationMinutes = Math.round((end - start) / 1000 / 60);
    
    if (durationMinutes < 60) return `${durationMinutes} minute${durationMinutes === 1 ? "" : "s"}`;
    const hours = Math.floor(durationMinutes / 60);
    const mins = durationMinutes % 60;
    if (mins === 0) return `${hours} hour${hours === 1 ? "" : "s"}`;
    return `${hours} hour${hours === 1 ? "" : "s"} ${mins} minute${mins === 1 ? "" : "s"}`;
  };

  const openEvents = incident.events.filter((e) => e.eventType === "OPENED");
  const resolveEvents = incident.events.filter((e) => e.eventType === "RESOLVED");

  return (
    <div className="space-y-4">
      {/* Header */}
      <section className="rounded border bg-white p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-semibold">Incident Details</h1>
              <span
                className={`rounded px-2 py-0.5 text-xs font-medium ${
                  incident.status === "OPEN"
                    ? "bg-red-100 text-red-700"
                    : "bg-slate-100 text-slate-600"
                }`}
              >
                {incident.status}
              </span>
              <span
                className={`rounded px-2 py-0.5 text-xs font-medium ${
                  incident.severity === "CRITICAL"
                    ? "bg-red-100 text-red-700"
                    : "bg-amber-100 text-amber-700"
                }`}
              >
                {incident.severity}
              </span>
            </div>
            <p className="mt-2 text-sm text-slate-600">
              Monitor:{" "}
              <Link to={`/app/monitors/${incident.monitor.id}`} className="underline">
                {incident.monitor.name}
              </Link>
            </p>
            <p className="text-sm text-slate-600">URL: {incident.monitor.url}</p>
          </div>

          <div className="flex gap-2">
            <Link to="/app/incidents" className="rounded border px-3 py-1.5 text-sm hover:bg-slate-50">
              Back to incidents
            </Link>
          </div>
        </div>
      </section>

      {/* Success/Error messages */}
      {actionData?.success && (
        <div className="rounded bg-emerald-50 p-4 text-sm text-emerald-700">
          {actionData.message}
        </div>
      )}
      {actionData?.error && (
        <div className="rounded bg-red-50 p-4 text-sm text-red-600">{actionData.error}</div>
      )}

      {/* Timeline */}
      <section className="rounded border bg-white p-6">
        <h2 className="text-sm font-semibold">Timeline</h2>
        <div className="mt-4 space-y-4">
          {/* Opened event */}
          <div className="flex gap-4">
            <div className="flex flex-col items-center">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-red-100">
                <div className="h-3 w-3 rounded-full bg-red-600"></div>
              </div>
              {incident.resolvedAt && <div className="w-px flex-1 bg-slate-200"></div>}
            </div>
            <div className="flex-1 pb-4">
              <div className="font-medium">Incident opened</div>
              <div className="text-sm text-slate-600">{formatTimestamp(incident.openedAt)}</div>
              <div className="mt-1 text-sm text-slate-600">Reason: {incident.openReason}</div>
            </div>
          </div>

          {/* Resolved event (if resolved) */}
          {incident.resolvedAt && (
            <div className="flex gap-4">
              <div className="flex flex-col items-center">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100">
                  <div className="h-3 w-3 rounded-full bg-slate-600"></div>
                </div>
              </div>
              <div className="flex-1">
                <div className="font-medium">Incident resolved</div>
                <div className="text-sm text-slate-600">{formatTimestamp(incident.resolvedAt)}</div>
                <div className="mt-1 text-sm text-slate-600">Reason: {incident.resolveReason}</div>
                <div className="mt-1 text-sm text-slate-600">Duration: {calculateDuration()}</div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Manual resolution (if still open) */}
      {incident.status === "OPEN" && (
        <section className="rounded border border-amber-200 bg-amber-50 p-6">
          <h2 className="text-sm font-semibold text-amber-900">Manual resolution</h2>
          <p className="mt-1 text-sm text-amber-800">
            If this incident was resolved outside of the monitoring system, you can manually mark it as resolved.
          </p>
          <Form method="post" className="mt-4 space-y-3">
            <input type="hidden" name="intent" value="resolve" />
            <div>
              <label htmlFor="reason" className="mb-1 block text-sm font-medium text-amber-900">
                Resolution reason
              </label>
              <textarea
                id="reason"
                name="reason"
                required
                rows={3}
                className="w-full rounded border px-3 py-2 text-sm"
                placeholder="e.g., Issue fixed manually, false alarm, etc."
              />
            </div>
            <button type="submit" className="rounded bg-amber-900 px-4 py-2 text-sm text-white hover:bg-amber-800">
              Mark as resolved
            </button>
          </Form>
        </section>
      )}

      {/* Notification events */}
      <section className="rounded border bg-white p-6">
        <h2 className="text-sm font-semibold">Notification events</h2>
        {incident.events.length === 0 ? (
          <p className="mt-3 text-sm text-slate-600">No notification events yet.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b text-left">
                <tr>
                  <th className="pb-2 pr-4">Channel</th>
                  <th className="pb-2 pr-4">Type</th>
                  <th className="pb-2 pr-4">Event type</th>
                  <th className="pb-2 pr-4">Status</th>
                  <th className="pb-2 pr-4">Attempts</th>
                  <th className="pb-2 pr-4">Sent at</th>
                  <th className="pb-2">Error</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {incident.events.map((event) => (
                  <tr key={event.id}>
                    <td className="py-3 pr-4 font-medium">{event.channel.name}</td>
                    <td className="py-3 pr-4 text-slate-600">{event.channel.type}</td>
                    <td className="py-3 pr-4">
                      <span
                        className={`rounded px-2 py-0.5 text-xs font-medium ${
                          event.eventType === "OPENED"
                            ? "bg-red-100 text-red-700"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {event.eventType}
                      </span>
                    </td>
                    <td className="py-3 pr-4">
                      <span
                        className={`rounded px-2 py-0.5 text-xs font-medium ${
                          event.status === "SENT"
                            ? "bg-emerald-100 text-emerald-700"
                            : event.status === "FAILED"
                            ? "bg-red-100 text-red-700"
                            : event.status === "PROCESSING"
                            ? "bg-blue-100 text-blue-700"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {event.status}
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-slate-600">{event.attemptCount}</td>
                    <td className="py-3 pr-4 text-slate-600">
                      {event.sentAt ? formatTimestamp(event.sentAt) : "—"}
                    </td>
                    <td className="py-3">
                      {event.lastError ? (
                        <span className="text-xs text-red-600" title={event.lastError}>
                          {event.lastError.length > 50
                            ? `${event.lastError.substring(0, 50)}...`
                            : event.lastError}
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Summary */}
        {incident.events.length > 0 && (
          <div className="mt-4 grid gap-3 border-t pt-4 md:grid-cols-3">
            <div>
              <div className="text-sm text-slate-600">Total notifications</div>
              <div className="mt-1 text-xl font-semibold">{incident.events.length}</div>
            </div>
            <div>
              <div className="text-sm text-slate-600">Sent successfully</div>
              <div className="mt-1 text-xl font-semibold text-emerald-600">
                {incident.events.filter((e) => e.status === "SENT").length}
              </div>
            </div>
            <div>
              <div className="text-sm text-slate-600">Failed</div>
              <div className="mt-1 text-xl font-semibold text-red-600">
                {incident.events.filter((e) => e.status === "FAILED").length}
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
