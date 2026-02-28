import { ALERT_OPEN_FAILURES, ALERT_RESOLVE_SUCCESSES, ALERT_COOLDOWN_MINUTES } from "~/lib/constants";
import { getEnabledAlertRulesForMonitor } from "~/models/monitoring/alert.server";
import { getOpenIncidentForMonitor, openIncident as createIncident, resolveIncident } from "~/models/monitoring/incident.server";
import { createNotificationEventsForIncident } from "~/models/monitoring/notification.server";

export async function evaluateMonitorAlertState({
  monitorId,
  consecutiveFailures,
  consecutiveSuccesses,
}: {
  monitorId: string;
  consecutiveFailures: number;
  consecutiveSuccesses: number;
}) {
  const existingOpenIncident = await getOpenIncidentForMonitor(monitorId);

  if (!existingOpenIncident && consecutiveFailures >= ALERT_OPEN_FAILURES) {
    const incident = await createIncident(monitorId, "CRITICAL", `Monitor failed ${consecutiveFailures} consecutive checks.`);

    const rules = await getEnabledAlertRulesForMonitor(monitorId);
    const channelIds = rules
      .filter((rule) => rule.ruleType === "DOWN")
      .flatMap((rule) => rule.subscriptions.map((sub) => sub.channelId));

    await createNotificationEventsForIncident({
      incidentId: incident.id,
      channelIds: [...new Set(channelIds)],
      eventType: "OPENED",
    });

    return { opened: incident.id, resolved: null, cooldownMinutes: ALERT_COOLDOWN_MINUTES };
  }

  if (existingOpenIncident && consecutiveSuccesses >= ALERT_RESOLVE_SUCCESSES) {
    const resolved = await resolveIncident(existingOpenIncident.id, `Monitor recovered after ${consecutiveSuccesses} consecutive successes.`);

    const rules = await getEnabledAlertRulesForMonitor(monitorId);
    const channelIds = rules
      .filter((rule) => rule.ruleType === "DOWN")
      .flatMap((rule) => rule.subscriptions.map((sub) => sub.channelId));

    await createNotificationEventsForIncident({
      incidentId: resolved.id,
      channelIds: [...new Set(channelIds)],
      eventType: "RESOLVED",
    });

    return { opened: null, resolved: resolved.id, cooldownMinutes: ALERT_COOLDOWN_MINUTES };
  }

  return { opened: null, resolved: null, cooldownMinutes: ALERT_COOLDOWN_MINUTES };
}
