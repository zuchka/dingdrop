export async function sendEmailNotification({ to, subject, body }: { to: string; subject: string; body: string }) {
  // Placeholder adapter. Wire to SES/Resend/Postmark in deployment.
  console.log("[email-notifier]", { to, subject, body: body.slice(0, 120) });
  return { ok: true };
}
