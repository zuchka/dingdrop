import { env } from "~/lib/env.server";
import { decryptJson } from "~/lib/crypto.server";
import { claimPendingNotificationEvents, markNotificationFailed, markNotificationSent } from "~/models/monitoring/notification.server";
import { sendEmailNotification } from "~/services/monitoring/email-notifier.server";
import { sendSlackWebhook } from "~/services/monitoring/slack-notifier.server";
import { sendDiscordWebhook } from "~/services/monitoring/discord-notifier.server";
import { sendPagerDutyEvent } from "~/services/monitoring/pagerduty-notifier.server";
import { sendTwilioSMS } from "~/services/monitoring/twilio-sms-notifier.server";
import { sendGenericWebhook } from "~/services/monitoring/webhook-notifier.server";
import { formatNotificationError } from "~/lib/utils/error-sanitizer";

function decodeChannelConfig(configEncrypted: string, channelId: string): Record<string, unknown> {
  try {
    return decryptJson<Record<string, unknown>>(configEncrypted);
  } catch (error) {
    throw new Error(`Failed to decrypt channel config for channel ${channelId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function runNotificationDispatchBatch(limit = 20) {
  if (!env.ENABLE_NOTIFICATIONS) {
    return { processed: 0, skipped: true };
  }

  const { token, events } = await claimPendingNotificationEvents(limit);

  for (const event of events) {
    const startTime = Date.now();

    try {
      console.log(`[Notification] Attempting delivery for event ${event.id} via ${event.channel.type} channel ${event.channel.id}`);

      const config = decodeChannelConfig(event.channel.configEncrypted, event.channel.id);
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
      } else if (event.channel.type === "DISCORD_WEBHOOK") {
        const webhookUrl = String(config.webhookUrl ?? "");
        if (!webhookUrl) {
          throw new Error("Missing discord webhookUrl");
        }
        await sendDiscordWebhook({ webhookUrl, text });
      } else if (event.channel.type === "PAGERDUTY") {
        const integrationKey = String(config.integrationKey ?? "");
        if (!integrationKey) {
          throw new Error("Missing PagerDuty integration key");
        }
        await sendPagerDutyEvent({
          integrationKey,
          eventType: event.eventType,
          summary: text,
          incidentId: event.incidentId,
        });
      } else if (event.channel.type === "SMS_TWILIO") {
        const accountSid = String(config.accountSid ?? "");
        const authToken = String(config.authToken ?? "");
        const fromNumber = String(config.fromNumber ?? "");
        const toNumber = String(config.toNumber ?? "");
        if (!accountSid || !authToken || !fromNumber || !toNumber) {
          throw new Error("Missing Twilio credentials (accountSid, authToken, fromNumber, or toNumber)");
        }
        await sendTwilioSMS({
          accountSid,
          authToken,
          fromNumber,
          toNumber,
          message: text,
        });
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

      const duration = Date.now() - startTime;
      console.log(`[Notification] Successfully delivered event ${event.id} in ${duration}ms`);

      await markNotificationSent(event.id, token);
    } catch (error) {
      const duration = Date.now() - startTime;
      const sanitizedError = formatNotificationError(error);

      console.error(`[Notification] Failed to deliver event ${event.id} after ${duration}ms:`, sanitizedError);

      await markNotificationFailed(
        event.id,
        token,
        sanitizedError,
        event.attemptCount,
      );
    }
  }

  return { processed: events.length, skipped: false };
}
