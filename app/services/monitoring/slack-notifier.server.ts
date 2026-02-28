const WEBHOOK_TIMEOUT_MS = 10_000; // 10 seconds

export async function sendSlackWebhook({ webhookUrl, text }: { webhookUrl: string; text: string }) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), WEBHOOK_TIMEOUT_MS);

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Slack delivery failed (${response.status}): ${body.slice(0, 500)}`);
    }

    return { ok: true };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Slack webhook timed out after ${WEBHOOK_TIMEOUT_MS}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}
