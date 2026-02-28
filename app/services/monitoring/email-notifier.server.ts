import { Resend } from "resend";
import { env } from "~/lib/env.server";

// Initialize Resend client if API key is available
let resend: Resend | null = null;
if (env.RESEND_API_KEY) {
  resend = new Resend(env.RESEND_API_KEY);
}

export async function sendEmailNotification({
  to,
  subject,
  body
}: {
  to: string;
  subject: string;
  body: string;
}) {
  // If Resend is not configured, log and return (development mode)
  if (!resend) {
    console.log("[email-notifier] Resend not configured, skipping email:", { to, subject, body: body.slice(0, 120) });
    return { ok: true };
  }

  try {
    const result = await resend.emails.send({
      from: env.RESEND_FROM_EMAIL,
      to,
      subject,
      html: formatIncidentEmail(body),
      text: body,
    });

    if (result.error) {
      throw new Error(`Resend API error: ${result.error.message}`);
    }

    console.log("[email-notifier] Email sent successfully via Resend:", result.data?.id);
    return { ok: true };
  } catch (error) {
    console.error("[email-notifier] Failed to send email:", error);
    throw error;
  }
}

/**
 * Format incident notification as HTML email
 */
function formatIncidentEmail(body: string): string {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Monitor Alert</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background-color: #f8f9fa; border-left: 4px solid #dc3545; padding: 16px; margin-bottom: 20px;">
          <h2 style="margin: 0 0 8px 0; color: #dc3545;">🚨 Monitor Alert</h2>
          <p style="margin: 0; white-space: pre-wrap;">${escapeHtml(body)}</p>
        </div>
        <div style="font-size: 12px; color: #6c757d; border-top: 1px solid #dee2e6; padding-top: 12px; margin-top: 20px;">
          <p style="margin: 0;">This is an automated notification from your ding.ing monitoring system.</p>
        </div>
      </body>
    </html>
  `;
}

/**
 * Escape HTML to prevent injection
 */
function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, (char) => map[char] || char);
}
