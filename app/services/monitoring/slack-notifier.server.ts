export async function sendSlackWebhook({ webhookUrl, text }: { webhookUrl: string; text: string }) {
  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ text }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Slack delivery failed (${response.status}): ${body.slice(0, 500)}`);
  }

  return { ok: true };
}
