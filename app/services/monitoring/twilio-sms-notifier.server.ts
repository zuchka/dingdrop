import { Twilio } from "twilio";

/**
 * Send SMS notification via Twilio
 * Note: Twilio credentials should be stored in channel config (encrypted)
 */
export async function sendTwilioSMS({
  accountSid,
  authToken,
  fromNumber,
  toNumber,
  message,
}: {
  accountSid: string;
  authToken: string;
  fromNumber: string;
  toNumber: string;
  message: string;
}) {
  try {
    const client = new Twilio(accountSid, authToken);

    const result = await client.messages.create({
      body: message,
      from: fromNumber,
      to: toNumber,
    });

    console.log("[Twilio] SMS sent:", result.sid);

    return { ok: true, sid: result.sid };
  } catch (error) {
    throw new Error(`Twilio SMS failed: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}
