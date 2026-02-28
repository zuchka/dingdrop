import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { useActionData, useLoaderData } from "@remix-run/react";
import type { AlertRuleType, IncidentSeverity } from "@prisma/client";
import { AlertRuleForm } from "~/components/alerts/alert-rule-form";
import { env } from "~/lib/env.server";
import { requireUserId } from "~/lib/session.server";
import { createAlertRule } from "~/models/monitoring/alert.server";
import { listChannelsForOrg } from "~/models/monitoring/channel.server";
import { listMonitorsForOrg } from "~/models/monitoring/monitor.server";
import { getUserOrgs } from "~/models/org.server";

export async function loader({ request }: LoaderFunctionArgs) {
  if (!env.ENABLE_MONITORS_UI) throw new Response("Not Found", { status: 404 });

  const userId = await requireUserId(request);
  const orgs = await getUserOrgs(userId);
  const org = orgs[0] ?? null;

  if (!org) {
    return json({ monitors: [], channels: [] });
  }

  const [monitors, channels] = await Promise.all([
    listMonitorsForOrg(org.id),
    listChannelsForOrg(org.id),
  ]);

  return json({
    monitors: monitors.map((m) => ({ id: m.id, name: m.name })),
    channels,
  });
}

export async function action({ request }: ActionFunctionArgs) {
  if (!env.ENABLE_MONITORS_UI) throw new Response("Not Found", { status: 404 });

  const userId = await requireUserId(request);
  const orgs = await getUserOrgs(userId);
  const org = orgs[0];
  if (!org) return json({ error: "No organization found." }, { status: 400 });

  const formData = await request.formData();
  const monitorId = String(formData.get("monitorId") ?? "").trim();
  const ruleType = String(formData.get("ruleType") ?? "").trim() as AlertRuleType;
  const severity = String(formData.get("severity") ?? "CRITICAL").trim() as IncidentSeverity;
  const thresholdInt = formData.get("thresholdInt") ? Number(formData.get("thresholdInt")) : null;
  const thresholdText = formData.get("thresholdText")
    ? String(formData.get("thresholdText")).trim()
    : null;
  const channelIds = formData.getAll("channelIds").map((id) => String(id));

  // Validation
  if (!monitorId) {
    return json({ error: "Monitor is required." }, { status: 400 });
  }

  if (!["DOWN", "LATENCY", "TLS_EXPIRY", "BODY_MISMATCH"].includes(ruleType)) {
    return json({ error: "Invalid rule type." }, { status: 400 });
  }

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

  try {
    const rule = await createAlertRule({
      monitorId,
      orgId: org.id,
      ruleType,
      severity,
      thresholdInt,
      thresholdText,
      channelIds,
    });

    throw redirect(`/app/alerts/${rule.id}`);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Failed to create alert rule.";
    return json({ error: errorMessage }, { status: 400 });
  }
}

export default function NewAlertRuleRoute() {
  const { monitors, channels } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();

  return (
    <section className="rounded border bg-white p-6">
      <h1 className="text-xl font-semibold">Create alert rule</h1>
      <p className="mt-1 text-sm text-slate-600">
        Configure an alert rule to receive notifications when a monitor fails or meets specific conditions.
      </p>

      <div className="mt-6">
        {monitors.length === 0 ? (
          <div className="rounded border bg-amber-50 p-4 text-sm text-amber-800">
            <p className="font-medium">No monitors available</p>
            <p className="mt-1">
              You need to create at least one monitor before creating alert rules.{" "}
              <a href="/app/monitors/new" className="underline">
                Create a monitor
              </a>
            </p>
          </div>
        ) : (
          <AlertRuleForm
            monitors={monitors}
            channels={channels}
            error={actionData?.error}
            submitLabel="Create alert rule"
          />
        )}
      </div>
    </section>
  );
}
