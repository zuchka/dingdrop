# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev              # Start development server
npm run build            # Production build
npm run start            # Serve production build
npm run typecheck        # TypeScript check (no emit)
npm run lint             # ESLint
npm run test             # All tests
npm run test:unit        # Unit tests only
npm run test:integration # Integration tests (runs sequentially, needs real DB)
npm run prisma:generate  # Regenerate Prisma client after schema changes
npm run prisma:migrate   # Run pending migrations (dev)
```

Integration tests require a running Postgres instance. They use `--maxWorkers=1` because they share a real database — never parallelize them.

## Environment Setup

Copy `.env.example` to `.env`. Required variables: `DATABASE_URL`, `DIRECT_URL`, `SESSION_SECRET`, `APP_BASE_URL`. All others have defaults.

**Database: Supabase** (`dingdrop-dev`, project `wmgudbosnqtuxfeglaar`, region `us-west-2`)
- `DATABASE_URL` — Supavisor session-mode pooler (`aws-0-us-west-2.pooler.supabase.com:5432`) for Prisma Client runtime
- `DIRECT_URL` — direct connection (`db.wmgudbosnqtuxfeglaar.supabase.co:5432`) for Prisma migrations

The monitoring subsystem is **off by default**. Enable it with feature flags:
- `ENABLE_MONITORS_UI=true` — show monitoring UI routes
- `ENABLE_PROBE_SCHEDULER=true` — start background scheduler
- `ENABLE_PROBE_WORKER=true` — start background probe executor
- `ENABLE_NOTIFICATIONS=true` — start notification dispatcher

## Architecture

### Stack
- **Remix + Vite** for routing and SSR
- **Prisma + PostgreSQL** for data
- **Tailwind CSS** for styling
- **Vitest** for tests
- **bcryptjs** for password hashing; session stored in a signed cookie

### Layer Separation

| Layer | Path | Purpose |
|-------|------|---------|
| Routes | `app/routes/` | Remix loaders/actions/UI |
| Services | `app/services/` | Domain orchestration (no direct Prisma calls) |
| Models | `app/models/` | Prisma query helpers, one file per aggregate |
| Lib | `app/lib/` | Auth, session, DB singleton, env, constants, security |
| Utils | `app/lib/utils/` | Pure helpers: key gen, cURL gen, redaction, formatting |

Files with `.server.ts` suffix are Node-only and never bundled for the browser.

### Route Naming

Remix file-based routing uses dot-notation for nesting:
- `app.tsx` — authenticated layout wrapper (guards all `/app/**`)
- `app.orgs.$orgSlug.endpoints.$endpointId.tsx` — endpoint detail with nested tabs
- `i.$endpointKey.tsx` — public ingestion route (`/i/:endpointKey`)

### Core Domains

**Webhook Ingestion** (`/i/:endpointKey`)
Authentication is via `x-dingdrop-secret` header or `?secret=` query param. The ingestion pipeline in `app/services/ingestion.server.ts` runs: `normalizeIncomingWebhook` → `applyTransforms` (no-op stub for future transforms) → `storeWebhook`.

**Replay** (`app/services/replay.server.ts`)
Forwards stored webhook bytes to a target URL using the original method, filtered headers (allowlist in `REPLAY_ALLOWED_HEADERS`), and a configurable timeout (`REPLAY_TIMEOUT_MS`). Every attempt is logged as a `ReplayAttempt`.

**Monitoring** (`app/services/monitoring/`)
Background processes bootstrapped in `bootstrap.server.ts` via `setInterval` calls that use `.unref()` so they don't block process exit:
- **Scheduler** — uses a PostgreSQL advisory lock (`pg_try_advisory_lock`) to prevent duplicate job scheduling across instances
- **Worker** — picks up `ProbeJob` rows and executes HTTP probes via either a native fetch executor or the Prometheus Blackbox Exporter
- **State engine** — transitions `MonitorState` between UP/DOWN/DEGRADED based on consecutive failure/success thresholds
- **Alert engine** — evaluates `AlertRule` rows after each probe run and opens/resolves `Incident` records
- **Notifier** — dispatches `NotificationEvent` rows to Email, Slack webhook, or generic webhook channels
- **Retention** — purges old `ProbeRun` and `NotificationEvent` rows on a 1-hour interval

`NotificationChannel.configEncrypted` stores channel credentials encrypted at rest using `app/lib/crypto.server.ts`.

### Multi-Tenancy

Every app query is scoped to an `Org`. `requireOrgMember(userId, orgSlug)` in the model layer enforces membership before any data access. Cross-org leakage is prevented by always joining through the org in queries, never by ID alone.

### Schema Conventions

All timestamps use `@db.Timestamptz(3)` (timezone-aware). Cascade deletes flow from `Org` → `Endpoint` → `WebhookRequest` → `ReplayAttempt`, and from `Org` → `Monitor` → all monitoring children.
