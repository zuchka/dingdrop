export const MAX_WEBHOOK_BODY_BYTES = Number(process.env.MAX_WEBHOOK_BODY_BYTES ?? 1_048_576);
export const INBOX_QUERY_LIMIT = Number(process.env.INBOX_QUERY_LIMIT ?? 500);
export const REPLAY_TIMEOUT_MS = Number(process.env.REPLAY_TIMEOUT_MS ?? 10_000);
export const PROBE_SNIPPET_MAX_BYTES = Number(process.env.PROBE_SNIPPET_MAX_BYTES ?? 4_096);
export const SCHEDULER_TICK_MS = Number(process.env.SCHEDULER_TICK_MS ?? 10_000);
export const MONITOR_INTERVAL_MIN_SEC = Number(process.env.MONITOR_INTERVAL_MIN_SEC ?? 60);
export const ALERT_OPEN_FAILURES = Number(process.env.ALERT_OPEN_FAILURES ?? 3);
export const ALERT_RESOLVE_SUCCESSES = Number(process.env.ALERT_RESOLVE_SUCCESSES ?? 2);
export const ALERT_COOLDOWN_MINUTES = Number(process.env.ALERT_COOLDOWN_MINUTES ?? 15);
export const MAX_MONITORS_PER_ORG = Number(process.env.MAX_MONITORS_PER_ORG ?? 100);
export const MAX_QUEUED_JOBS_PER_ORG = Number(process.env.MAX_QUEUED_JOBS_PER_ORG ?? 500);
export const PROBE_RUN_RETENTION_DAYS = Number(process.env.PROBE_RUN_RETENTION_DAYS ?? 30);
export const NOTIFICATION_EVENT_RETENTION_DAYS = Number(process.env.NOTIFICATION_EVENT_RETENTION_DAYS ?? 90);
export const REPLAY_BLOCKED_HEADERS = [
  "host",
  "content-length",
  "authorization",
  "proxy-authorization",
  "cookie",
  "set-cookie",
];
export const REPLAY_ALLOWED_HEADERS = (process.env.REPLAY_ALLOWED_HEADERS ?? "content-type,user-agent")
  .split(",")
  .map((header) => header.trim().toLowerCase())
  .filter(Boolean)
  .filter((header) => !REPLAY_BLOCKED_HEADERS.includes(header));
