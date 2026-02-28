process.env.NODE_ENV = "test";
process.env.DATABASE_URL ??= "postgresql://postgres:postgres@localhost:5432/dingdrop";
process.env.SESSION_SECRET ??= "test-session-secret-that-is-at-least-32-bytes";
process.env.APP_BASE_URL ??= "http://localhost:3000";
process.env.MAX_WEBHOOK_BODY_BYTES ??= "1048576";
process.env.INBOX_QUERY_LIMIT ??= "500";
process.env.REPLAY_TIMEOUT_MS ??= "10000";
process.env.REPLAY_ALLOWED_HEADERS ??= "content-type,user-agent";
