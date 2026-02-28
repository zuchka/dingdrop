import type { ProbeRun } from "@prisma/client";
import { ALERT_OPEN_FAILURES, ALERT_RESOLVE_SUCCESSES, ALERT_COOLDOWN_MINUTES } from "~/lib/constants";
import { getEnabledAlertRulesForMonitor } from "~/models/monitoring/alert.server";
import { getOpenIncidentForMonitor, openIncident as createIncident, resolveIncident } from "~/models/monitoring/incident.server";
import { createNotificationEventsForIncident } from "~/models/monitoring/notification.server";

/**
 * Evaluate alert rules for a monitor after a probe run
 */
export async function evaluateMonitorAlertState({
  monitorId,
  consecutiveFailures,
  consecutiveSuccesses,
  latestProbeRun,
}: {
  monitorId: string;
  consecutiveFailures: number;
  consecutiveSuccesses: number;
  latestProbeRun?: ProbeRun | null;
}) {
  const rules = await getEnabledAlertRulesForMonitor(monitorId);

  // Evaluate DOWN rules (existing logic)
  await evaluateDownRules({
    monitorId,
    consecutiveFailures,
    consecutiveSuccesses,
    rules: rules.filter((r) => r.ruleType === "DOWN"),
  });

  // Evaluate other rule types if we have a probe run
  if (latestProbeRun) {
    await evaluateLatencyRules({
      monitorId,
      probeRun: latestProbeRun,
      rules: rules.filter((r) => r.ruleType === "LATENCY"),
    });

    await evaluateTlsExpiryRules({
      monitorId,
      probeRun: latestProbeRun,
      rules: rules.filter((r) => r.ruleType === "TLS_EXPIRY"),
    });

    await evaluateBodyMismatchRules({
      monitorId,
      probeRun: latestProbeRun,
      rules: rules.filter((r) => r.ruleType === "BODY_MISMATCH"),
    });
  }

  return { cooldownMinutes: ALERT_COOLDOWN_MINUTES };
}

/**
 * Evaluate DOWN alert rules (original logic)
 */
async function evaluateDownRules({
  monitorId,
  consecutiveFailures,
  consecutiveSuccesses,
  rules,
}: {
  monitorId: string;
  consecutiveFailures: number;
  consecutiveSuccesses: number;
  rules: any[];
}) {
  if (rules.length === 0) return;

  const existingOpenIncident = await getOpenIncidentForMonitor(monitorId);

  // Open incident if threshold reached
  if (!existingOpenIncident && consecutiveFailures >= ALERT_OPEN_FAILURES) {
    const incident = await createIncident(
      monitorId,
      "CRITICAL",
      `Monitor failed ${consecutiveFailures} consecutive checks.`
    );

    const channelIds = rules.flatMap((rule) => rule.subscriptions.map((sub: any) => sub.channelId));

    await createNotificationEventsForIncident({
      incidentId: incident.id,
      channelIds: [...new Set(channelIds)],
      eventType: "OPENED",
    });
  }

  // Resolve incident if threshold reached
  if (existingOpenIncident && consecutiveSuccesses >= ALERT_RESOLVE_SUCCESSES) {
    const resolved = await resolveIncident(
      existingOpenIncident.id,
      `Monitor recovered after ${consecutiveSuccesses} consecutive successes.`
    );

    const channelIds = rules.flatMap((rule) => rule.subscriptions.map((sub: any) => sub.channelId));

    await createNotificationEventsForIncident({
      incidentId: resolved.id,
      channelIds: [...new Set(channelIds)],
      eventType: "RESOLVED",
    });
  }
}

/**
 * Evaluate LATENCY alert rules
 */
async function evaluateLatencyRules({
  monitorId,
  probeRun,
  rules,
}: {
  monitorId: string;
  probeRun: ProbeRun;
  rules: any[];
}) {
  for (const rule of rules) {
    const threshold = rule.thresholdInt;
    if (!threshold || !probeRun.latencyMs) continue;

    const isViolating = probeRun.latencyMs > threshold;
    const existingIncident = await getOpenIncidentForMonitor(monitorId);

    // Open incident if latency exceeds threshold
    if (isViolating && !existingIncident) {
      const incident = await createIncident(
        monitorId,
        rule.severity,
        `Latency ${probeRun.latencyMs}ms exceeds threshold ${threshold}ms.`
      );

      const channelIds = rule.subscriptions.map((sub: any) => sub.channelId);
      await createNotificationEventsForIncident({
        incidentId: incident.id,
        channelIds,
        eventType: "OPENED",
      });
    }

    // Resolve incident if latency is back under threshold
    if (!isViolating && existingIncident && probeRun.ok) {
      const resolved = await resolveIncident(
        existingIncident.id,
        `Latency ${probeRun.latencyMs}ms returned below threshold ${threshold}ms.`
      );

      const channelIds = rule.subscriptions.map((sub: any) => sub.channelId);
      await createNotificationEventsForIncident({
        incidentId: resolved.id,
        channelIds,
        eventType: "RESOLVED",
      });
    }
  }
}

/**
 * Evaluate TLS_EXPIRY alert rules
 */
async function evaluateTlsExpiryRules({
  monitorId,
  probeRun,
  rules,
}: {
  monitorId: string;
  probeRun: ProbeRun;
  rules: any[];
}) {
  for (const rule of rules) {
    const threshold = rule.thresholdInt; // days until expiry
    if (!threshold || probeRun.tlsDaysRemaining === null) continue;

    const isViolating = probeRun.tlsDaysRemaining < threshold;
    const existingIncident = await getOpenIncidentForMonitor(monitorId);

    // Open incident if certificate expiring soon
    if (isViolating && !existingIncident) {
      const incident = await createIncident(
        monitorId,
        rule.severity,
        `TLS certificate expires in ${probeRun.tlsDaysRemaining} days (threshold: ${threshold} days).`
      );

      const channelIds = rule.subscriptions.map((sub: any) => sub.channelId);
      await createNotificationEventsForIncident({
        incidentId: incident.id,
        channelIds,
        eventType: "OPENED",
      });
    }

    // Resolve incident if certificate renewed (more days remaining than threshold)
    if (!isViolating && existingIncident && probeRun.ok) {
      const resolved = await resolveIncident(
        existingIncident.id,
        `TLS certificate renewed. Now expires in ${probeRun.tlsDaysRemaining} days.`
      );

      const channelIds = rule.subscriptions.map((sub: any) => sub.channelId);
      await createNotificationEventsForIncident({
        incidentId: resolved.id,
        channelIds,
        eventType: "RESOLVED",
      });
    }
  }
}

/**
 * Evaluate BODY_MISMATCH alert rules
 */
async function evaluateBodyMismatchRules({
  monitorId,
  probeRun,
  rules,
}: {
  monitorId: string;
  probeRun: ProbeRun;
  rules: any[];
}) {
  for (const rule of rules) {
    const pattern = rule.thresholdText;
    if (!pattern || !probeRun.responseSnippet) continue;

    // Check if response body matches the expected pattern
    let bodyMatches = false;
    try {
      const regex = new RegExp(pattern, "i");
      bodyMatches = regex.test(probeRun.responseSnippet);
    } catch (err) {
      // If regex is invalid, try exact string match
      bodyMatches = probeRun.responseSnippet.includes(pattern);
    }

    const isViolating = !bodyMatches; // Alert if body does NOT match
    const existingIncident = await getOpenIncidentForMonitor(monitorId);

    // Open incident if body doesn't match expected pattern
    if (isViolating && !existingIncident && probeRun.ok) {
      const incident = await createIncident(
        monitorId,
        rule.severity,
        `Response body does not match expected pattern: "${pattern}".`
      );

      const channelIds = rule.subscriptions.map((sub: any) => sub.channelId);
      await createNotificationEventsForIncident({
        incidentId: incident.id,
        channelIds,
        eventType: "OPENED",
      });
    }

    // Resolve incident if body now matches pattern
    if (!isViolating && existingIncident && probeRun.ok) {
      const resolved = await resolveIncident(
        existingIncident.id,
        `Response body now matches expected pattern: "${pattern}".`
      );

      const channelIds = rule.subscriptions.map((sub: any) => sub.channelId);
      await createNotificationEventsForIncident({
        incidentId: resolved.id,
        channelIds,
        eventType: "RESOLVED",
      });
    }
  }
}
