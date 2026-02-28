function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

function bool(name: string, fallback: boolean) {
  const value = process.env[name];
  if (value == null) return fallback;
  return value === "1" || value.toLowerCase() === "true";
}

const MONITOR_CHANNEL_SECRET = process.env.MONITOR_CHANNEL_SECRET ?? "dev-monitor-channel-secret-change-me";

// Validate MONITOR_CHANNEL_SECRET is set and secure
if (!process.env.MONITOR_CHANNEL_SECRET) {
  console.warn("⚠️  WARNING: MONITOR_CHANNEL_SECRET not set, using insecure default. Set this in production!");
}

if (MONITOR_CHANNEL_SECRET === "dev-monitor-channel-secret-change-me" && process.env.NODE_ENV === "production") {
  throw new Error("MONITOR_CHANNEL_SECRET must be changed from default value in production");
}

if (MONITOR_CHANNEL_SECRET.length < 32) {
  throw new Error("MONITOR_CHANNEL_SECRET must be at least 32 characters long for security");
}

export const env = {
  DATABASE_URL: required("DATABASE_URL"),
  SESSION_SECRET: required("SESSION_SECRET"),
  APP_BASE_URL: required("APP_BASE_URL"),
  ENABLE_MONITORS_UI: bool("ENABLE_MONITORS_UI", false),
  ENABLE_PROBE_SCHEDULER: bool("ENABLE_PROBE_SCHEDULER", false),
  ENABLE_PROBE_WORKER: bool("ENABLE_PROBE_WORKER", false),
  ENABLE_NOTIFICATIONS: bool("ENABLE_NOTIFICATIONS", false),
  DEBUG_VERBOSE: bool("DEBUG_VERBOSE", false),
  PROBE_EXECUTOR: process.env.PROBE_EXECUTOR ?? "blackbox",
  BLACKBOX_BASE_URL: process.env.BLACKBOX_BASE_URL ?? "http://localhost:9115",
  BLACKBOX_HTTP_MODULE: process.env.BLACKBOX_HTTP_MODULE ?? "http_2xx",
  MONITOR_CHANNEL_SECRET,
  RESEND_API_KEY: process.env.RESEND_API_KEY,
  RESEND_FROM_EMAIL: process.env.RESEND_FROM_EMAIL ?? "alerts@ding.ing",
};
