import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { Form, useActionData, useLoaderData } from "@remix-run/react";
import { env } from "~/lib/env.server";
import { requireUserId } from "~/lib/session.server";
import { listAlertRulesForOrg, replaceAlertRuleSubscriptions, updateAlertRule } from "~/models/monitoring/alert.server";
import { listChannelsForOrg } from "~/models/monitoring/channel.server";
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
    return json({ rules: [], channels: [] });
  }

  const [rules, channels] = await Promise.all([listAlertRulesForOrg(org.id), listChannelsForOrg(org.id)]);
  return json({ rules, channels });
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

export default function AlertsRoute() {
  const { rules, channels } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();

  return (
    <section className="space-y-4">
      <div className="rounded border bg-white p-6">
        <h1 className="text-xl font-semibold">Alerts</h1>
        <p className="mt-1 text-sm text-slate-600">Manage alert rules and notification subscriptions.</p>
        {actionData && "error" in actionData && actionData.error ? (
          <p className="mt-2 text-sm text-red-600">{actionData.error}</p>
        ) : null}
      </div>

      {rules.length === 0 ? (
        <div className="rounded border bg-white p-6 text-slate-600">No alert rules yet.</div>
      ) : (
        <div className="space-y-3">
          {rules.map((rule) => {
            const selected = new Set(rule.subscriptions.map((sub) => sub.channelId));

            return (
              <div key={rule.id} className="rounded border bg-white p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-medium">{rule.monitor.name}: {rule.ruleType}</div>
                    <div className="text-sm text-slate-600">Severity: {rule.severity}</div>
                  </div>

                  <Form method="post" className="flex items-center gap-2">
                    <input type="hidden" name="intent" value="toggleRule" />
                    <input type="hidden" name="ruleId" value={rule.id} />
                    <input type="hidden" name="enabled" value={rule.enabled ? "false" : "true"} />
                    <button type="submit" className="rounded border px-3 py-1.5 text-sm">{rule.enabled ? "Disable" : "Enable"}</button>
                  </Form>
                </div>

                <Form method="post" className="mt-3 space-y-2">
                  <input type="hidden" name="intent" value="setChannels" />
                  <input type="hidden" name="ruleId" value={rule.id} />

                  {channels.length === 0 ? (
                    <p className="text-sm text-slate-600">No channels available. Create channels first.</p>
                  ) : (
                    <div className="grid gap-2 md:grid-cols-2">
                      {channels.map((channel) => (
                        <label key={channel.id} className="flex items-center gap-2 text-sm">
                          <input type="checkbox" name="channelIds" value={channel.id} defaultChecked={selected.has(channel.id)} />
                          {channel.name} ({channel.type})
                        </label>
                      ))}
                    </div>
                  )}

                  <button type="submit" className="rounded bg-slate-900 px-3 py-1.5 text-sm text-white">
                    Save subscriptions
                  </button>
                </Form>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
