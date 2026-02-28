export async function sendGenericWebhook({
  webhookUrl,
  payload,
}: {
  webhookUrl: string;
  payload: Record<string, unknown>;
}) {
  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Webhook delivery failed (${response.status}): ${body.slice(0, 500)}`);
  }

  return { ok: true };
}
