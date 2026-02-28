import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import type { AlertRuleType, IncidentSeverity } from "@prisma/client";
import { Form, useActionData, useFetcher, useLoaderData } from "@remix-run/react";
import { AlertFilters } from "~/components/alerts/alert-filters";
import { env } from "~/lib/env.server";
import { requireUserId } from "~/lib/session.server";
import {
  getAlertRulesWithPagination,
  listAlertRulesForOrg,
  replaceAlertRuleSubscriptions,
  updateAlertRule,
} from "~/models/monitoring/alert.server";
import { listChannelsForOrg } from "~/models/monitoring/channel.server";
import { listMonitorsForOrg } from "~/models/monitoring/monitor.server";
import { getUserOrgs } from "~/models/org.server";

function clean(value: FormDataEntryValue | null) {
  return String(value ?? "").trim();
}

export async function loader({ request }: LoaderFunctionArgs) {
  if (!env.ENABLE_MONITORS_UI) throw new Response("Not Found", { status: 404 });

  const userId = await requireUserId(request);
  const orgs = await getUserOrgs(userId);
  const org = orgs[0] ?? null;

  if (!org) {
    return json({
      rules: [],
      channels: [],
      monitors: [],
      totalCount: 0,
      page: 1,
      totalPages: 0,
      pageSize: 20,
    });
  }

  // Parse URL search params for filtering and pagination
  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get("page") || "1", 10);
  const pageSize = 20;
  const ruleType = url.searchParams.get("ruleType") as AlertRuleType | null;
  const severity = url.searchParams.get("severity") as IncidentSeverity | null;
  const enabledParam = url.searchParams.get("enabled");
  const enabled = enabledParam === "true" ? true : enabledParam === "false" ? false : undefined;
  const monitorId = url.searchParams.get("monitorId") || undefined;
  const search = url.searchParams.get("search") || undefined;

  const [paginatedResult, channels, monitors] = await Promise.all([
    getAlertRulesWithPagination({
      orgId: org.id,
      page,
      pageSize,
      filters: {
        ruleType: ruleType || undefined,
        severity: severity || undefined,
        enabled,
        monitorId,
        search,
      },
    }),
    listChannelsForOrg(org.id),
    listMonitorsForOrg(org.id),
  ]);

  return json({
    rules: paginatedResult.rules,
    totalCount: paginatedResult.totalCount,
    page: paginatedResult.page,
    totalPages: paginatedResult.totalPages,
    pageSize: paginatedResult.pageSize,
    channels,
    monitors: monitors.map((m) => ({ id: m.id, name: m.name })),
  });
}

export async function action({ request }: ActionFunctionArgs) {
  if (!env.ENABLE_MONITORS_UI) throw new Response("Not Found", { status: 404 });

  const userId = await requireUserId(request);
  const orgs = await getUserOrgs(userId);
  const org = orgs[0];
  if (!org) return json({ error: "No organization found." }, { status: 400 });

  const formData = await request.formData();
  const intent = clean(formData.get("intent"));
  const ruleId = clean(formData.get("ruleId"));

  const rules = await listAlertRulesForOrg(org.id);
  const rule = rules.find((r) => r.id === ruleId);
  if (!rule) return json({ error: "Rule not found." }, { status: 404 });

  if (intent === "toggleRule") {
    const enabled = clean(formData.get("enabled")) === "true";
    await updateAlertRule({ monitorId: rule.monitorId, ruleId, enabled });
    return json({ ok: true });
  }

  if (intent === "setChannels") {
    const channelIds = formData.getAll("channelIds").map((value) => String(value));
    const channels = await listChannelsForOrg(org.id);
    const allowed = new Set(channels.map((channel) => channel.id));

    const filtered = channelIds.filter((id) => allowed.has(id));
    await replaceAlertRuleSubscriptions({ ruleId, channelIds: filtered });
    return json({ ok: true });
  }

  return json({ error: "Unsupported action." }, { status: 400 });
}

function AlertRuleRow({ rule }: { rule: any }) {
  const fetcher = useFetcher();

  const isToggling = fetcher.state !== "idle" && fetcher.formData?.get("ruleId") === rule.id;
  const optimisticEnabled = isToggling
    ? fetcher.formData?.get("enabled") === "true"
    : rule.enabled;

  return (
    <tr className="hover:bg-slate-50">
      <td className="px-4 py-3">
        <a href={`/app/monitors/${rule.monitor.id}`} className="font-medium hover:underline">
          {rule.monitor.name}
        </a>
      </td>
      <td className="px-4 py-3">
        <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-medium">
          {rule.ruleType}
        </span>
      </td>
      <td className="px-4 py-3">
        <span
          className={`rounded px-2 py-0.5 text-xs font-medium ${
            rule.severity === "CRITICAL"
              ? "bg-red-100 text-red-700"
              : "bg-amber-100 text-amber-700"
          }`}
        >
          {rule.severity}
        </span>
      </td>
      <td className="px-4 py-3">
        <span
          className={`rounded px-2 py-0.5 text-xs font-medium ${
            optimisticEnabled
              ? "bg-emerald-100 text-emerald-700"
              : "bg-slate-100 text-slate-600"
          }`}
        >
          {optimisticEnabled ? "Enabled" : "Disabled"}
        </span>
      </td>
      <td className="px-4 py-3">
        <span className="text-slate-600">
          {rule.subscriptions.length === 0
            ? "None"
            : `${rule.subscriptions.length} channel${
                rule.subscriptions.length === 1 ? "" : "s"
              }`}
        </span>
      </td>
      <td className="px-4 py-3 text-right">
        <div className="flex items-center justify-end gap-2">
          <a
            href={`/app/alerts/${rule.id}`}
            className="rounded border px-3 py-1.5 text-sm hover:bg-slate-50"
          >
            View
          </a>
          <fetcher.Form method="post">
            <input type="hidden" name="intent" value="toggleRule" />
            <input type="hidden" name="ruleId" value={rule.id} />
            <input type="hidden" name="enabled" value={optimisticEnabled ? "false" : "true"} />
            <button
              type="submit"
              disabled={isToggling}
              className="rounded border px-3 py-1.5 text-sm hover:bg-slate-50 disabled:opacity-50"
            >
              {isToggling ? "..." : optimisticEnabled ? "Disable" : "Enable"}
            </button>
          </fetcher.Form>
        </div>
      </td>
    </tr>
  );
}

export default function AlertsRoute() {
  const { rules, totalCount, page, totalPages, monitors } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();

  const hasFilters = new URL(typeof window !== "undefined" ? window.location.href : "http://localhost").searchParams.toString() !== "";

  return (
    <section className="space-y-4">
      <div className="rounded border bg-white p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold">Alert rules</h1>
            <p className="mt-1 text-sm text-slate-600">
              Configure alerts to receive notifications when monitors fail or meet specific conditions.
            </p>
          </div>
          <a
            href="/app/alerts/new"
            className="rounded bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-800"
          >
            Create alert rule
          </a>
        </div>
        {actionData && "error" in actionData && actionData.error ? (
          <p className="mt-3 text-sm text-red-600">{actionData.error}</p>
        ) : null}
      </div>

      {/* Filters */}
      <AlertFilters monitors={monitors} showSearch={true} />

      {rules.length === 0 ? (
        <div className="rounded border bg-white p-6">
          {hasFilters || totalCount > 0 ? (
            <>
              <p className="text-slate-600">No alert rules match your filters.</p>
              <a href="/app/alerts" className="mt-2 inline-block text-sm text-slate-600 underline">
                Clear filters
              </a>
            </>
          ) : (
            <>
              <p className="text-slate-600">No alert rules yet.</p>
              <p className="mt-2 text-sm text-slate-500">
                Create your first alert rule to receive notifications when monitors fail or meet specific conditions.
              </p>
              <a
                href="/app/alerts/new"
                className="mt-4 inline-block rounded border px-4 py-2 text-sm hover:bg-slate-50"
              >
                Create alert rule
              </a>
            </>
          )}
        </div>
      ) : (
        <>
          <div className="overflow-x-auto rounded border bg-white">
            <table className="w-full text-sm">
              <thead className="border-b bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Monitor</th>
                  <th className="px-4 py-3 text-left font-medium">Rule type</th>
                  <th className="px-4 py-3 text-left font-medium">Severity</th>
                  <th className="px-4 py-3 text-left font-medium">Status</th>
                  <th className="px-4 py-3 text-left font-medium">Channels</th>
                  <th className="px-4 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {rules.map((rule) => (
                  <AlertRuleRow key={rule.id} rule={rule} />
                ))}
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
                      ...Object.fromEntries(new URL(typeof window !== "undefined" ? window.location.href : "http://localhost").searchParams),
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
                      ...Object.fromEntries(new URL(typeof window !== "undefined" ? window.location.href : "http://localhost").searchParams),
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
              Showing {rules.length} of {totalCount} alert rule{totalCount === 1 ? "" : "s"}
            </div>
          )}
        </>
      )}
    </section>
  );
}
