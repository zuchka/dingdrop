process.env.NODE_ENV = "test";
process.env.DATABASE_URL ??= "postgresql://postgres:postgres@localhost:5432/ding-ing";
process.env.SESSION_SECRET ??= "test-session-secret-that-is-at-least-32-bytes";
process.env.APP_BASE_URL ??= "http://localhost:3000";
