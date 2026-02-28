import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { Form, useActionData } from "@remix-run/react";
import { MAX_MONITORS_PER_ORG, MONITOR_INTERVAL_MIN_SEC } from "~/lib/constants";
import { env } from "~/lib/env.server";
import { requireUserId } from "~/lib/session.server";
import { createMonitor, listMonitorsForOrg } from "~/models/monitoring/monitor.server";
import { getUserOrgs } from "~/models/org.server";
import { validateMonitorTargetUrlWithDns } from "~/services/monitoring/target-policy.server";

export async function loader({ request }: LoaderFunctionArgs) {
  if (!env.ENABLE_MONITORS_UI) throw new Response("Not Found", { status: 404 });
  await requireUserId(request);
  return null;
}

export async function action({ request }: ActionFunctionArgs) {
  if (!env.ENABLE_MONITORS_UI) throw new Response("Not Found", { status: 404 });

  const userId = await requireUserId(request);
  const orgs = await getUserOrgs(userId);
  const org = orgs[0];
  if (!org) throw redirect("/app/orgs/new");

  const formData = await request.formData();
  const name = String(formData.get("name") ?? "").trim();
  const url = String(formData.get("url") ?? "").trim();
  const method = String(formData.get("method") ?? "GET") as "GET" | "HEAD" | "POST";
  const intervalSec = Number(formData.get("intervalSec") ?? 60);
  const timeoutMs = Number(formData.get("timeoutMs") ?? 10000);
  const expectedStatusMode = String(formData.get("expectedStatusMode") ?? "RANGE_2XX") as "RANGE_2XX" | "EXACT_SET";
  const expectedStatusCodesRaw = String(formData.get("expectedStatusCodes") ?? "").trim();
  const bodyMatchType = String(formData.get("bodyMatchType") ?? "NONE") as "NONE" | "CONTAINS" | "REGEX";
  const bodyMatchPattern = String(formData.get("bodyMatchPattern") ?? "").trim() || null;
  const latencyWarnMs = Number(formData.get("latencyWarnMs") ?? 0) || null;
  const tlsExpiryWarnDays = Number(formData.get("tlsExpiryWarnDays") ?? 0) || null;

  if (!name) return json({ error: "Name is required." }, { status: 400 });
  const validatedTarget = await validateMonitorTargetUrlWithDns(url);
  if (!validatedTarget.ok) return json({ error: validatedTarget.error }, { status: 400 });
  if (!Number.isFinite(intervalSec) || intervalSec < MONITOR_INTERVAL_MIN_SEC) {
    return json({ error: `Interval must be at least ${MONITOR_INTERVAL_MIN_SEC} seconds.` }, { status: 400 });
  }

  const existingMonitors = await listMonitorsForOrg(org.id);
  if (existingMonitors.length >= MAX_MONITORS_PER_ORG) {
    return json({ error: `Monitor quota reached (${MAX_MONITORS_PER_ORG}).` }, { status: 400 });
  }

  const expectedStatusCodes = expectedStatusCodesRaw
    ? expectedStatusCodesRaw
        .split(",")
        .map((v) => Number(v.trim()))
        .filter((v) => Number.isFinite(v) && v > 0)
    : null;

  const monitor = await createMonitor({
    orgId: org.id,
    name,
    url,
    method,
    intervalSec,
    timeoutMs,
    expectedStatusMode,
    expectedStatusCodes,
    bodyMatchType,
    bodyMatchPattern,
    latencyWarnMs,
    tlsExpiryWarnDays,
  });

  throw redirect(`/app/monitors/${monitor.id}`);
}

export default function NewMonitorRoute() {
  const actionData = useActionData<typeof action>();

  return (
    <section className="rounded border bg-white p-6">
      <h1 className="text-xl font-semibold">Create monitor</h1>
      <Form method="post" className="mt-4 grid gap-4 md:grid-cols-2">
        <label className="block md:col-span-2">
          <span className="mb-1 block text-sm">Name</span>
          <input name="name" required className="w-full rounded border px-3 py-2" placeholder="API health" />
        </label>

        <label className="block md:col-span-2">
          <span className="mb-1 block text-sm">URL</span>
          <input name="url" type="url" required className="w-full rounded border px-3 py-2" placeholder="https://example.com/health" />
        </label>

        <label className="block">
          <span className="mb-1 block text-sm">Method</span>
          <select name="method" defaultValue="GET" className="w-full rounded border px-3 py-2">
            <option value="GET">GET</option>
            <option value="HEAD">HEAD</option>
            <option value="POST">POST</option>
          </select>
        </label>

        <label className="block">
          <span className="mb-1 block text-sm">Interval (sec)</span>
          <input name="intervalSec" type="number" defaultValue={60} min={60} className="w-full rounded border px-3 py-2" />
        </label>

        <label className="block">
          <span className="mb-1 block text-sm">Timeout (ms)</span>
          <input name="timeoutMs" type="number" defaultValue={10000} min={1000} className="w-full rounded border px-3 py-2" />
        </label>

        <label className="block">
          <span className="mb-1 block text-sm">Expected status mode</span>
          <select name="expectedStatusMode" defaultValue="RANGE_2XX" className="w-full rounded border px-3 py-2">
            <option value="RANGE_2XX">Any 2xx</option>
            <option value="EXACT_SET">Exact list</option>
          </select>
        </label>

        <label className="block md:col-span-2">
          <span className="mb-1 block text-sm">Expected status list (comma-separated for exact mode)</span>
          <input name="expectedStatusCodes" className="w-full rounded border px-3 py-2" placeholder="200,204" />
        </label>

        <label className="block">
          <span className="mb-1 block text-sm">Body match type</span>
          <select name="bodyMatchType" defaultValue="NONE" className="w-full rounded border px-3 py-2">
            <option value="NONE">None</option>
            <option value="CONTAINS">Contains</option>
            <option value="REGEX">Regex</option>
          </select>
        </label>

        <label className="block">
          <span className="mb-1 block text-sm">Body match pattern</span>
          <input name="bodyMatchPattern" className="w-full rounded border px-3 py-2" placeholder="ok" />
        </label>

        <label className="block">
          <span className="mb-1 block text-sm">Latency warn (ms)</span>
          <input name="latencyWarnMs" type="number" min={0} className="w-full rounded border px-3 py-2" placeholder="500" />
        </label>

        <label className="block">
          <span className="mb-1 block text-sm">TLS warn (days)</span>
          <input name="tlsExpiryWarnDays" type="number" min={0} className="w-full rounded border px-3 py-2" placeholder="14" />
        </label>

        {actionData?.error ? <p className="md:col-span-2 text-sm text-red-600">{actionData.error}</p> : null}

        <div className="md:col-span-2">
          <button type="submit" className="rounded bg-slate-900 px-4 py-2 text-white">Create monitor</button>
        </div>
      </Form>
    </section>
  );
}
