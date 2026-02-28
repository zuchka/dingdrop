const WEBHOOK_TIMEOUT_MS = 10_000; // 10 seconds

export async function sendGenericWebhook({
  webhookUrl,
  payload,
}: {
  webhookUrl: string;
  payload: Record<string, unknown>;
}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), WEBHOOK_TIMEOUT_MS);

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Webhook delivery failed (${response.status}): ${body.slice(0, 500)}`);
    }

    return { ok: true };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Webhook timed out after ${WEBHOOK_TIMEOUT_MS}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}
