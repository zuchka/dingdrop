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

**Database: Supabase** (project `wmgudbosnqtuxfeglaar`, region `us-west-2`)
- `DATABASE_URL` — Supavisor session-mode pooler (`aws-0-us-west-2.pooler.supabase.com:5432`) for Prisma Client runtime
- `DIRECT_URL` — direct connection (`db.wmgudbosnqtuxfeglaar.supabase.co:5432`) for Prisma migrations

The monitoring subsystem is **off by default**. Enable it with feature flags:
- `ENABLE_MONITORS_UI=true` — show monitoring UI routes
- `ENABLE_PROBE_SCHEDULER=true` — start background scheduler
- `ENABLE_PROBE_WORKER=true` — start background probe executor
- `ENABLE_NOTIFICATIONS=true` — start notification dispatcher

## Monitoring Development Setup

The monitoring system uses [Prometheus Blackbox Exporter](https://github.com/prometheus/blackbox_exporter) to execute HTTP probes. For local development, run it via Docker Compose:

### Quick Start

```bash
# 1. Start the Blackbox Exporter
docker-compose up -d

# 2. Copy environment file (if not already done)
cp .env.example .env

# 3. Enable monitoring features in .env
# ENABLE_MONITORS_UI=true
# ENABLE_PROBE_SCHEDULER=true
# ENABLE_PROBE_WORKER=true

# 4. Start the Remix dev server
npm run dev
```

### Verify Setup

Check the exporter is running:
```bash
# Health check
curl http://localhost:9115/health

# View metrics
curl http://localhost:9115/metrics

# Test a probe manually
curl "http://localhost:9115/probe?target=https://google.com&module=http_2xx"
```

### Troubleshooting

**Port 9115 already in use:**
```bash
# Find and stop the process using port 9115
lsof -ti:9115 | xargs kill -9
# Or change the port mapping in docker-compose.yml and update BLACKBOX_BASE_URL
```

**Exporter not reachable from Remix app:**
- Ensure Docker container is running: `docker ps | grep blackbox`
- Check logs: `docker-compose logs blackbox-exporter`
- Verify `BLACKBOX_BASE_URL=http://localhost:9115` in your `.env`

**Configuration changes:**
```bash
# After editing blackbox.yml, restart the container
docker-compose restart blackbox-exporter
```

### Configuration Notes

- **Local Dev:** `BLACKBOX_BASE_URL=http://localhost:9115` (host machine → Docker port mapping)
- **Docker Compose Full Stack:** `BLACKBOX_BASE_URL=http://blackbox-exporter:9115` (container-to-container)
- **Production/K8s:** Use service discovery name or cluster DNS

The default `http_2xx` module is configured in `blackbox.yml` with sensible defaults. Additional modules are available:
- `http_post_2xx` — for POST requests
- `tcp_connect` — for TCP probes
- `icmp` — for ping probes (requires privileged mode)

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
- `app.monitors.$monitorId.tsx` — monitor detail with nested views

### Core Domains

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

All timestamps use `@db.Timestamptz(3)` (timezone-aware). Cascade deletes flow from `Org` → `Monitor` → all monitoring children (ProbeJob, ProbeRun, AlertRule, Incident, etc.).
