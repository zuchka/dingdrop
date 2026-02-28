import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { env } from "~/lib/env.server";

function deriveKey() {
  return createHash("sha256").update(env.MONITOR_CHANNEL_SECRET).digest();
}

export function encryptJson(value: Record<string, unknown>) {
  const key = deriveKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);

  const plaintext = Buffer.from(JSON.stringify(value), "utf-8");
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return Buffer.concat([iv, authTag, encrypted]).toString("base64");
}

export function decryptJson<T extends Record<string, unknown>>(encoded: string): T {
  const payload = Buffer.from(encoded, "base64");
  const iv = payload.subarray(0, 12);
  const authTag = payload.subarray(12, 28);
  const ciphertext = payload.subarray(28);

  const key = deriveKey();
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return JSON.parse(decrypted.toString("utf-8")) as T;
}
