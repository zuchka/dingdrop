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

export const env = {
  DATABASE_URL: required("DATABASE_URL"),
  SESSION_SECRET: required("SESSION_SECRET"),
  APP_BASE_URL: required("APP_BASE_URL"),
  ENABLE_MONITORS_UI: bool("ENABLE_MONITORS_UI", false),
  ENABLE_PROBE_SCHEDULER: bool("ENABLE_PROBE_SCHEDULER", false),
  ENABLE_PROBE_WORKER: bool("ENABLE_PROBE_WORKER", false),
  ENABLE_NOTIFICATIONS: bool("ENABLE_NOTIFICATIONS", false),
  PROBE_EXECUTOR: process.env.PROBE_EXECUTOR ?? "blackbox",
  BLACKBOX_BASE_URL: process.env.BLACKBOX_BASE_URL ?? "http://localhost:9115",
  BLACKBOX_HTTP_MODULE: process.env.BLACKBOX_HTTP_MODULE ?? "http_2xx",
  MONITOR_CHANNEL_SECRET: process.env.MONITOR_CHANNEL_SECRET ?? "dev-monitor-channel-secret-change-me",
};
