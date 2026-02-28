const WEBHOOK_TIMEOUT_MS = 10_000; // 10 seconds

/**
 * Send notification to Discord via webhook
 * Discord webhook API: https://discord.com/developers/docs/resources/webhook#execute-webhook
 */
export async function sendDiscordWebhook({ webhookUrl, text }: { webhookUrl: string; text: string }) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), WEBHOOK_TIMEOUT_MS);

  try {
    // Discord expects 'content' field for the message
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ 
        content: text,
        // Optional: Add embeds for richer formatting
        embeds: [{
          description: text,
          color: text.includes('OPENED') ? 0xDC3545 : 0x28A745, // Red for OPENED, Green for RESOLVED
          timestamp: new Date().toISOString(),
        }],
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Discord delivery failed (${response.status}): ${body.slice(0, 500)}`);
    }

    return { ok: true };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Discord webhook timed out after ${WEBHOOK_TIMEOUT_MS}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}
