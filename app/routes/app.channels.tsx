import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { Form, useActionData, useLoaderData } from "@remix-run/react";
import { useState, useEffect } from "react";
import { env } from "~/lib/env.server";
import { requireUserId } from "~/lib/session.server";
import { createChannelForOrg, listChannelsForOrg, updateChannelForOrg, deleteChannelForOrg } from "~/models/monitoring/channel.server";
import { getUserOrgs } from "~/models/org.server";
import { validateEmail, validateWebhookUrl } from "~/lib/utils/validate-url";
import { Toast } from "~/components/ui/toast";

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
    const type = clean(formData.get("type")) as "EMAIL" | "SLACK_WEBHOOK" | "DISCORD_WEBHOOK" | "PAGERDUTY" | "SMS_TWILIO" | "GENERIC_WEBHOOK";
    const name = clean(formData.get("name"));
    if (!name) return json({ error: "Channel name is required." }, { status: 400 });

    let config: Record<string, unknown> = {};

    if (type === "EMAIL") {
      const to = clean(formData.get("to"));
      if (!to) return json({ error: "Email recipient is required." }, { status: 400 });
      try {
        validateEmail(to);
      } catch (err) {
        return json({ error: err instanceof Error ? err.message : "Invalid email" }, { status: 400 });
      }
      config = { to };
    } else if (type === "PAGERDUTY") {
      const integrationKey = clean(formData.get("integrationKey"));
      if (!integrationKey) return json({ error: "PagerDuty integration key is required." }, { status: 400 });
      config = { integrationKey };
    } else if (type === "SMS_TWILIO") {
      const accountSid = clean(formData.get("accountSid"));
      const authToken = clean(formData.get("authToken"));
      const fromNumber = clean(formData.get("fromNumber"));
      const toNumber = clean(formData.get("toNumber"));

      if (!accountSid || !authToken || !fromNumber || !toNumber) {
        return json({ error: "All Twilio fields are required." }, { status: 400 });
      }

      config = { accountSid, authToken, fromNumber, toNumber };
    } else {
      const webhookUrl = clean(formData.get("webhookUrl"));
      if (!webhookUrl) return json({ error: "Webhook URL is required." }, { status: 400 });
      try {
        validateWebhookUrl(webhookUrl);
      } catch (err) {
        return json({ error: err instanceof Error ? err.message : "Invalid webhook URL" }, { status: 400 });
      }
      config = { webhookUrl };
    }

    await createChannelForOrg({ orgId: org.id, type, name, config });
    return json({ ok: true, success: "Channel created successfully!" });
  }

  if (intent === "toggle") {
    const channelId = clean(formData.get("channelId"));
    const enabled = clean(formData.get("enabled")) === "true";
    if (!channelId) return json({ error: "Missing channel id." }, { status: 400 });

    await updateChannelForOrg({ orgId: org.id, channelId, enabled });
    return json({ ok: true, success: `Channel ${enabled ? "enabled" : "disabled"} successfully!` });
  }

  if (intent === "test") {
    const channelId = clean(formData.get("channelId"));
    if (!channelId) return json({ error: "Missing channel id." }, { status: 400 });

    const { getChannelForOrg } = await import("~/models/monitoring/channel.server");
    const { sendEmailNotification } = await import("~/services/monitoring/email-notifier.server");
    const { sendSlackWebhook } = await import("~/services/monitoring/slack-notifier.server");
    const { sendDiscordWebhook } = await import("~/services/monitoring/discord-notifier.server");
    const { sendPagerDutyEvent } = await import("~/services/monitoring/pagerduty-notifier.server");
    const { sendTwilioSMS } = await import("~/services/monitoring/twilio-sms-notifier.server");
    const { sendGenericWebhook } = await import("~/services/monitoring/webhook-notifier.server");
    const { decryptJson } = await import("~/lib/crypto.server");

    const channel = await getChannelForOrg(org.id, channelId);
    if (!channel) return json({ error: "Channel not found." }, { status: 404 });

    try {
      const config = decryptJson<Record<string, unknown>>(channel.configEncrypted);
      const testMessage = `🧪 Test notification from ding.ing - ${new Date().toLocaleString()}`;

      if (channel.type === "EMAIL") {
        const to = String(config.to ?? "");
        if (!to) throw new Error("Missing email recipient");
        await sendEmailNotification({
          to,
          subject: "Test notification from ding.ing",
          body: testMessage
        });
      } else if (channel.type === "SLACK_WEBHOOK") {
        const webhookUrl = String(config.webhookUrl ?? "");
        if (!webhookUrl) throw new Error("Missing webhook URL");
        await sendSlackWebhook({ webhookUrl, text: testMessage });
      } else if (channel.type === "DISCORD_WEBHOOK") {
        const webhookUrl = String(config.webhookUrl ?? "");
        if (!webhookUrl) throw new Error("Missing webhook URL");
        await sendDiscordWebhook({ webhookUrl, text: testMessage });
      } else if (channel.type === "PAGERDUTY") {
        const integrationKey = String(config.integrationKey ?? "");
        if (!integrationKey) throw new Error("Missing PagerDuty integration key");
        await sendPagerDutyEvent({
          integrationKey,
          eventType: "OPENED",
          summary: testMessage,
          incidentId: `test-${Date.now()}`,
        });
      } else if (channel.type === "SMS_TWILIO") {
        const accountSid = String(config.accountSid ?? "");
        const authToken = String(config.authToken ?? "");
        const fromNumber = String(config.fromNumber ?? "");
        const toNumber = String(config.toNumber ?? "");
        if (!accountSid || !authToken || !fromNumber || !toNumber) {
          throw new Error("Missing Twilio credentials");
        }
        await sendTwilioSMS({ accountSid, authToken, fromNumber, toNumber, message: testMessage });
      } else {
        const webhookUrl = String(config.webhookUrl ?? "");
        if (!webhookUrl) throw new Error("Missing webhook URL");
        await sendGenericWebhook({
          webhookUrl,
          payload: {
            eventType: "TEST",
            message: testMessage,
            timestamp: new Date().toISOString(),
          },
        });
      }

      return json({ ok: true, success: "Test notification sent successfully!" });
    } catch (error) {
      return json({
        error: `Failed to send test: ${error instanceof Error ? error.message : "Unknown error"}`
      }, { status: 500 });
    }
  }

  if (intent === "edit") {
    const channelId = clean(formData.get("channelId"));
    const name = clean(formData.get("name"));

    if (!channelId) return json({ error: "Missing channel id." }, { status: 400 });
    if (!name) return json({ error: "Channel name is required." }, { status: 400 });

    try {
      await updateChannelForOrg({ orgId: org.id, channelId, name });
      return json({ ok: true, success: "Channel updated successfully!" });
    } catch (error) {
      return json({
        error: `Failed to update channel: ${error instanceof Error ? error.message : "Unknown error"}`
      }, { status: 500 });
    }
  }

  if (intent === "delete") {
    const channelId = clean(formData.get("channelId"));

    if (!channelId) return json({ error: "Missing channel id." }, { status: 400 });

    try {
      await deleteChannelForOrg(org.id, channelId);
      return json({ ok: true, success: "Channel deleted successfully!" });
    } catch (error) {
      return json({
        error: `Failed to delete channel: ${error instanceof Error ? error.message : "Unknown error"}`
      }, { status: 500 });
    }
  }

  return json({ error: "Unsupported action." }, { status: 400 });
}

export default function ChannelsRoute() {
  const { channels } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const [toast, setToast] = useState<{ message: string; tone: "success" | "error" } | null>(null);
  const [selectedType, setSelectedType] = useState<"EMAIL" | "SLACK_WEBHOOK" | "DISCORD_WEBHOOK" | "PAGERDUTY" | "SMS_TWILIO" | "GENERIC_WEBHOOK">("EMAIL");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  // Show toast when action completes successfully
  useEffect(() => {
    if (actionData && "success" in actionData && actionData.success) {
      setToast({ message: actionData.success, tone: "success" });
      setEditingId(null); // Close edit mode on success
    }
  }, [actionData]);

  return (
    <>
      {toast && (
        <Toast
          message={toast.message}
          tone={toast.tone}
          onClose={() => setToast(null)}
        />
      )}
      <section className="space-y-4">
      <div className="rounded border bg-white p-6">
        <h1 className="text-xl font-semibold">Notification channels</h1>
        <p className="mt-1 text-sm text-slate-600">Create email, Slack, or webhook destinations for monitor incidents.</p>

        <Form method="post" className="mt-4 grid gap-3 md:grid-cols-2">
          <input type="hidden" name="intent" value="create" />

          <label className="block">
            <span className="mb-1 block text-sm">Type</span>
            <select
              name="type"
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value as typeof selectedType)}
              className="w-full rounded border px-3 py-2"
            >
              <option value="EMAIL">Email</option>
              <option value="SLACK_WEBHOOK">Slack webhook</option>
              <option value="DISCORD_WEBHOOK">Discord webhook</option>
              <option value="PAGERDUTY">PagerDuty</option>
              <option value="SMS_TWILIO">SMS (Twilio)</option>
              <option value="GENERIC_WEBHOOK">Generic webhook</option>
            </select>
          </label>

          <label className="block">
            <span className="mb-1 block text-sm">Name</span>
            <input
              name="name"
              required
              minLength={1}
              maxLength={100}
              className="w-full rounded border px-3 py-2"
              placeholder="On-call email"
            />
          </label>

          {selectedType === "EMAIL" && (
            <label className="block md:col-span-2">
              <span className="mb-1 block text-sm">Email recipient</span>
              <input
                type="email"
                name="to"
                required
                className="w-full rounded border px-3 py-2"
                placeholder="alerts@example.com"
              />
            </label>
          )}

          {(selectedType === "SLACK_WEBHOOK" || selectedType === "DISCORD_WEBHOOK" || selectedType === "GENERIC_WEBHOOK") && (
            <label className="block md:col-span-2">
              <span className="mb-1 block text-sm">
                Webhook URL
                {selectedType === "SLACK_WEBHOOK" && " (from Slack Incoming Webhooks)"}
                {selectedType === "DISCORD_WEBHOOK" && " (from Discord Server Settings → Integrations → Webhooks)"}
              </span>
              <input
                type="url"
                name="webhookUrl"
                required
                pattern="https://.*"
                className="w-full rounded border px-3 py-2"
                placeholder={
                  selectedType === "DISCORD_WEBHOOK"
                    ? "https://discord.com/api/webhooks/..."
                    : "https://hooks.slack.com/services/..."
                }
                title="Must be a valid HTTPS URL"
              />
            </label>
          )}

          {selectedType === "PAGERDUTY" && (
            <label className="block md:col-span-2">
              <span className="mb-1 block text-sm">Integration Key (from PagerDuty Service → Integrations → Events API V2)</span>
              <input
                type="text"
                name="integrationKey"
                required
                className="w-full rounded border px-3 py-2"
                placeholder="R1234567890ABCDEF..."
              />
            </label>
          )}

          {selectedType === "SMS_TWILIO" && (
            <>
              <label className="block">
                <span className="mb-1 block text-sm">Twilio Account SID</span>
                <input
                  type="text"
                  name="accountSid"
                  required
                  className="w-full rounded border px-3 py-2"
                  placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm">Twilio Auth Token</span>
                <input
                  type="password"
                  name="authToken"
                  required
                  className="w-full rounded border px-3 py-2"
                  placeholder="Your auth token"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm">From Number (Twilio number)</span>
                <input
                  type="tel"
                  name="fromNumber"
                  required
                  pattern="\\+[0-9]{10,15}"
                  className="w-full rounded border px-3 py-2"
                  placeholder="+1234567890"
                  title="Must start with + and include country code"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm">To Number (recipient)</span>
                <input
                  type="tel"
                  name="toNumber"
                  required
                  pattern="\\+[0-9]{10,15}"
                  className="w-full rounded border px-3 py-2"
                  placeholder="+1234567890"
                  title="Must start with + and include country code"
                />
              </label>
            </>
          )}

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
              <li key={channel.id} className="rounded border p-3">
                {editingId === channel.id ? (
                  <Form method="post" className="flex items-center gap-2">
                    <input type="hidden" name="intent" value="edit" />
                    <input type="hidden" name="channelId" value={channel.id} />
                    <input
                      type="text"
                      name="name"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="flex-1 rounded border px-3 py-1.5 text-sm"
                      placeholder="Channel name"
                      required
                    />
                    <button
                      type="submit"
                      className="rounded bg-slate-900 px-3 py-1.5 text-sm text-white"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                      className="rounded border px-3 py-1.5 text-sm"
                    >
                      Cancel
                    </button>
                  </Form>
                ) : (
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">{channel.name}</div>
                      <div className="text-slate-600 text-sm">{channel.type}</div>
                    </div>

                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingId(channel.id);
                          setEditName(channel.name);
                        }}
                        className="rounded border border-slate-300 bg-white px-3 py-1.5 text-sm hover:bg-slate-50"
                        title="Edit channel name"
                      >
                        Edit
                      </button>

                      <Form method="post">
                        <input type="hidden" name="intent" value="test" />
                        <input type="hidden" name="channelId" value={channel.id} />
                        <button
                          type="submit"
                          className="rounded border border-slate-300 bg-white px-3 py-1.5 text-sm hover:bg-slate-50"
                          title="Send test notification"
                        >
                          Test
                        </button>
                      </Form>

                      <Form method="post">
                        <input type="hidden" name="intent" value="toggle" />
                        <input type="hidden" name="channelId" value={channel.id} />
                        <input type="hidden" name="enabled" value={channel.enabled ? "false" : "true"} />
                        <button type="submit" className="rounded border px-3 py-1.5 text-sm">
                          {channel.enabled ? "Disable" : "Enable"}
                        </button>
                      </Form>

                      <Form
                        method="post"
                        onSubmit={(e) => {
                          if (!confirm(`Are you sure you want to delete "${channel.name}"? This cannot be undone.`)) {
                            e.preventDefault();
                          }
                        }}
                      >
                        <input type="hidden" name="intent" value="delete" />
                        <input type="hidden" name="channelId" value={channel.id} />
                        <button
                          type="submit"
                          className="rounded border border-red-300 bg-white px-3 py-1.5 text-sm text-red-600 hover:bg-red-50"
                          title="Delete channel"
                        >
                          Delete
                        </button>
                      </Form>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
    </>
  );
}
