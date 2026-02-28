import { env } from "~/lib/env.server";
import { decryptJson } from "~/lib/crypto.server";
import { claimPendingNotificationEvents, markNotificationFailed, markNotificationSent } from "~/models/monitoring/notification.server";
import { sendEmailNotification } from "~/services/monitoring/email-notifier.server";
import { sendSlackWebhook } from "~/services/monitoring/slack-notifier.server";
import { sendGenericWebhook } from "~/services/monitoring/webhook-notifier.server";

function decodeChannelConfig(configEncrypted: string): Record<string, unknown> {
  try {
    return decryptJson<Record<string, unknown>>(configEncrypted);
  } catch {
    return {};
  }
}

export async function runNotificationDispatchBatch(limit = 20) {
  if (!env.ENABLE_NOTIFICATIONS) {
    return { processed: 0, skipped: true };
  }

  const { token, events } = await claimPendingNotificationEvents(limit);

  for (const event of events) {
    try {
      const config = decodeChannelConfig(event.channel.configEncrypted);
      const text = `[${event.eventType}] ${event.incident.monitor.name}: ${event.incident.openReason}`;

      if (event.channel.type === "EMAIL") {
        const to = String(config.to ?? "");
        if (!to) {
          throw new Error("Missing email recipient (config.to)");
        }
        await sendEmailNotification({ to, subject: `ding.ing ${event.eventType}`, body: text });
      } else if (event.channel.type === "SLACK_WEBHOOK") {
        const webhookUrl = String(config.webhookUrl ?? "");
        if (!webhookUrl) {
          throw new Error("Missing slack webhookUrl");
        }
        await sendSlackWebhook({ webhookUrl, text });
      } else {
        const webhookUrl = String(config.webhookUrl ?? "");
        if (!webhookUrl) {
          throw new Error("Missing webhook webhookUrl");
        }
        await sendGenericWebhook({
          webhookUrl,
          payload: {
            eventType: event.eventType,
            incidentId: event.incidentId,
            monitorId: event.incident.monitorId,
            monitorName: event.incident.monitor.name,
            reason: event.incident.openReason,
            status: event.incident.status,
            at: new Date().toISOString(),
          },
        });
      }

      await markNotificationSent(event.id, token);
    } catch (error) {
      await markNotificationFailed(
        event.id,
        token,
        error instanceof Error ? error.message : "Notification failure",
        event.attemptCount,
      );
    }
  }

  return { processed: events.length, skipped: false };
}
