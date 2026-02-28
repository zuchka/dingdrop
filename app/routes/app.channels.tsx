import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { Form, useActionData, useLoaderData } from "@remix-run/react";
import { env } from "~/lib/env.server";
import { requireUserId } from "~/lib/session.server";
import { createChannelForOrg, listChannelsForOrg, updateChannelForOrg } from "~/models/monitoring/channel.server";
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
    return json({ org: null, channels: [] as Array<{ id: string; name: string; type: string; enabled: boolean }> });
  }

  const channels = await listChannelsForOrg(org.id);
  return json({ org, channels });
}

export async function action({ request }: ActionFunctionArgs) {
  if (!env.ENABLE_MONITORS_UI) throw new Response("Not Found", { status: 404 });

  const userId = await requireUserId(request);
  const orgs = await getUserOrgs(userId);
  const org = orgs[0];
  if (!org) return json({ error: "No organization found." }, { status: 400 });

  const formData = await request.formData();
  const intent = clean(formData.get("intent"));

  if (intent === "create") {
    const type = clean(formData.get("type")) as "EMAIL" | "SLACK_WEBHOOK" | "GENERIC_WEBHOOK";
    const name = clean(formData.get("name"));
    if (!name) return json({ error: "Channel name is required." }, { status: 400 });

    let config: Record<string, unknown> = {};
    if (type === "EMAIL") {
      const to = clean(formData.get("to"));
      if (!to) return json({ error: "Email recipient is required." }, { status: 400 });
      config = { to };
    } else {
      const webhookUrl = clean(formData.get("webhookUrl"));
      if (!webhookUrl) return json({ error: "Webhook URL is required." }, { status: 400 });
      config = { webhookUrl };
    }

    await createChannelForOrg({ orgId: org.id, type, name, config });
    return json({ ok: true });
  }

  if (intent === "toggle") {
    const channelId = clean(formData.get("channelId"));
    const enabled = clean(formData.get("enabled")) === "true";
    if (!channelId) return json({ error: "Missing channel id." }, { status: 400 });

    await updateChannelForOrg({ orgId: org.id, channelId, enabled });
    return json({ ok: true });
  }

  return json({ error: "Unsupported action." }, { status: 400 });
}

export default function ChannelsRoute() {
  const { channels } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();

  return (
    <section className="space-y-4">
      <div className="rounded border bg-white p-6">
        <h1 className="text-xl font-semibold">Notification channels</h1>
        <p className="mt-1 text-sm text-slate-600">Create email, Slack, or webhook destinations for monitor incidents.</p>

        <Form method="post" className="mt-4 grid gap-3 md:grid-cols-2">
          <input type="hidden" name="intent" value="create" />

          <label className="block">
            <span className="mb-1 block text-sm">Type</span>
            <select name="type" defaultValue="EMAIL" className="w-full rounded border px-3 py-2">
              <option value="EMAIL">Email</option>
              <option value="SLACK_WEBHOOK">Slack webhook</option>
              <option value="GENERIC_WEBHOOK">Generic webhook</option>
            </select>
          </label>

          <label className="block">
            <span className="mb-1 block text-sm">Name</span>
            <input name="name" className="w-full rounded border px-3 py-2" placeholder="On-call email" />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm">Email recipient (for Email)</span>
            <input name="to" className="w-full rounded border px-3 py-2" placeholder="alerts@example.com" />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm">Webhook URL (for Slack/Webhook)</span>
            <input name="webhookUrl" className="w-full rounded border px-3 py-2" placeholder="https://hooks.slack.com/services/..." />
          </label>

          {actionData && "error" in actionData && actionData.error ? (
            <p className="md:col-span-2 text-sm text-red-600">{actionData.error}</p>
          ) : null}

          <div className="md:col-span-2">
            <button type="submit" className="rounded bg-slate-900 px-4 py-2 text-white">Create channel</button>
          </div>
        </Form>
      </div>

      <div className="rounded border bg-white p-6">
        {channels.length === 0 ? (
          <p className="text-slate-600">No channels configured yet.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {channels.map((channel) => (
              <li key={channel.id} className="flex items-center justify-between rounded border p-3">
                <div>
                  <div className="font-medium">{channel.name}</div>
                  <div className="text-slate-600">{channel.type}</div>
                </div>

                <Form method="post">
                  <input type="hidden" name="intent" value="toggle" />
                  <input type="hidden" name="channelId" value={channel.id} />
                  <input type="hidden" name="enabled" value={channel.enabled ? "false" : "true"} />
                  <button type="submit" className="rounded border px-3 py-1.5 text-sm">
                    {channel.enabled ? "Disable" : "Enable"}
                  </button>
                </Form>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
