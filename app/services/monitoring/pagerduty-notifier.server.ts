const PAGERDUTY_EVENTS_API = "https://events.pagerduty.com/v2/enqueue";
const WEBHOOK_TIMEOUT_MS = 10_000; // 10 seconds

/**
 * Send incident event to PagerDuty Events API v2
 * Docs: https://developer.pagerduty.com/docs/ZG9jOjExMDI5NTgw-events-api-v2-overview
 */
export async function sendPagerDutyEvent({
  integrationKey,
  eventType,
  summary,
  incidentId,
}: {
  integrationKey: string;
  eventType: "OPENED" | "RESOLVED";
  summary: string;
  incidentId: string;
}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), WEBHOOK_TIMEOUT_MS);

  try {
    // Map our event types to PagerDuty event actions
    const eventAction = eventType === "OPENED" ? "trigger" : "resolve";
    
    const payload = {
      routing_key: integrationKey,
      event_action: eventAction,
      dedup_key: `ding-ing-incident-${incidentId}`, // Use incident ID as dedup key
      payload: {
        summary,
        severity: eventType === "OPENED" ? "critical" : "info",
        source: "ding.ing",
        timestamp: new Date().toISOString(),
      },
    };

    const response = await fetch(PAGERDUTY_EVENTS_API, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`PagerDuty delivery failed (${response.status}): ${body.slice(0, 500)}`);
    }

    const result = await response.json();
    console.log("[PagerDuty] Event sent:", result);

    return { ok: true };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`PagerDuty API timed out after ${WEBHOOK_TIMEOUT_MS}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}
