# Ding - Uptime Monitoring System

A comprehensive uptime monitoring and alerting platform built with Remix, PostgreSQL, and Prometheus Blackbox Exporter.

## Features

- 🔍 **HTTP/HTTPS Monitoring** - Monitor website availability and response times
- 📊 **Real-time Dashboards** - View metrics, incidents, and probe history
- 🚨 **Alert Management** - Configurable alert rules with thresholds
- 📢 **Multi-channel Notifications** - Email, Slack, Discord, PagerDuty, webhooks
- 🏢 **Multi-tenancy** - Organization-based access control
- ⏱️ **Probe Scheduling** - Flexible monitoring intervals (1min - 24hr)
- 📈 **Metrics & Analytics** - Track uptime, response times, and incidents

## Quick Start

### Prerequisites

- Node.js 20+
- PostgreSQL database
- Docker (for local development with Blackbox Exporter)

### Local Development

1. **Clone and install dependencies:**
   ```bash
   git clone <your-repo-url>
   cd ding-ing
   npm install
   ```

2. **Set up environment variables:**
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` and configure:
   - `DATABASE_URL` - PostgreSQL connection string
   - `DIRECT_URL` - Direct PostgreSQL connection (for migrations)
   - `SESSION_SECRET` - Random secret for session signing
   - `APP_BASE_URL` - Your app URL (http://localhost:3000 for dev)

3. **Run database migrations:**
   ```bash
   npm run prisma:migrate
   ```

4. **Start Blackbox Exporter (optional, for monitoring features):**
   ```bash
   docker-compose up -d
   ```

5. **Start the development server:**
   ```bash
   npm run dev
   ```

Visit http://localhost:3000

### Enabling Monitoring Features

The monitoring subsystem is disabled by default. Enable it in `.env`:

```env
ENABLE_MONITORS_UI=true          # Show monitoring UI routes
ENABLE_PROBE_SCHEDULER=true      # Start background scheduler
ENABLE_PROBE_WORKER=true         # Start probe executor
ENABLE_NOTIFICATIONS=true        # Enable notifications
BLACKBOX_BASE_URL=http://localhost:9115
```

## Deployment

### Deploy to Railway

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/template)

#### Step-by-Step Railway Deployment

1. **Create a new Railway project:**
   - Go to [Railway](https://railway.app)
   - Click "New Project" → "Deploy from GitHub repo"
   - Select your repository

2. **Add PostgreSQL database:**
   - In your Railway project, click "New" → "Database" → "Add PostgreSQL"
   - Railway will automatically provision a database and set `DATABASE_URL`

3. **Configure environment variables:**
   
   In your Railway service settings, add these variables:

   **Required:**
   ```env
   SESSION_SECRET=<generate-random-string-min-32-chars>
   MONITOR_CHANNEL_SECRET=<generate-random-string-min-32-chars>
   APP_BASE_URL=${{RAILWAY_PUBLIC_DOMAIN}}
   ```

   **For monitoring features:**
   ```env
   ENABLE_MONITORS_UI=true
   ENABLE_PROBE_SCHEDULER=true
   ENABLE_PROBE_WORKER=true
   ENABLE_NOTIFICATIONS=true
   PROBE_EXECUTOR=fetch
   ```

   **For email notifications (optional):**
   ```env
   RESEND_API_KEY=re_your_api_key
   RESEND_FROM_EMAIL=alerts@yourdomain.com
   ```

4. **Set up Blackbox Exporter (optional):**
   
   If you want to use Blackbox Exporter instead of native fetch:
   - Add a new service with Docker image: `prom/blackbox-exporter:latest`
   - Configure `BLACKBOX_BASE_URL` to point to the internal Railway service URL
   - Update `PROBE_EXECUTOR=blackbox`

5. **Deploy:**
   - Railway will automatically build and deploy your app
   - Migrations run automatically on each deployment
   - Your app will be available at `https://<your-app>.railway.app`

#### Generate Secrets

Use these commands to generate secure random secrets:

```bash
# On macOS/Linux:
openssl rand -base64 32

# Or using Node.js:
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

#### Railway Configuration Notes

- **Automatic migrations:** The `railway.yaml` runs `prisma migrate deploy` on each deployment
- **Health checks:** Railway monitors the `/` endpoint
- **Restart policy:** Automatically restarts on failure (max 10 retries)
- **Database:** Use Railway's PostgreSQL service for `DATABASE_URL`
- **Scaling:** Railway supports horizontal scaling for the web service

### Other Deployment Options

#### Docker

Build and run with Docker:

```bash
docker build -t ding-monitoring .
docker run -p 3000:3000 --env-file .env ding-monitoring
```

#### Manual Deployment

For any Node.js hosting platform:

1. Build the application:
   ```bash
   npm ci
   npm run prisma:generate
   npm run build
   ```

2. Run migrations:
   ```bash
   npx prisma migrate deploy
   ```

3. Start the server:
   ```bash
   npm run start
   ```

## Available Scripts

```bash
npm run dev              # Start development server
npm run build            # Production build
npm run start            # Serve production build
npm run typecheck        # TypeScript check
npm run lint             # Run ESLint
npm run test             # Run all tests
npm run test:unit        # Unit tests only
npm run test:integration # Integration tests
npm run prisma:generate  # Regenerate Prisma client
npm run prisma:migrate   # Run database migrations
```

## Architecture

### Tech Stack

- **Framework:** Remix + Vite
- **Database:** PostgreSQL + Prisma ORM
- **Styling:** Tailwind CSS
- **Testing:** Vitest
- **Monitoring:** Prometheus Blackbox Exporter (optional)
- **Authentication:** bcryptjs + signed session cookies

### Project Structure

```
app/
├── routes/          # Remix routes (loaders, actions, UI)
├── services/        # Business logic and orchestration
├── models/          # Database queries (Prisma)
├── components/      # React components
├── lib/             # Auth, session, utilities
└── entry.*.tsx      # Remix entry points

prisma/
└── schema.prisma    # Database schema

tests/
├── unit/            # Unit tests
└── integration/     # Integration tests
```

### Key Features

- **Multi-tenancy:** All queries scoped to organizations
- **Background jobs:** Scheduler, worker, alert engine, notifier
- **Encryption:** Channel credentials encrypted at rest
- **Advisory locks:** PostgreSQL locks prevent duplicate job scheduling
- **Retention policies:** Automatic cleanup of old probe runs and events

## Environment Variables

See `.env.example` for all available options. Key variables:

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | ✅ | PostgreSQL connection string |
| `SESSION_SECRET` | ✅ | Secret for session signing |
| `APP_BASE_URL` | ✅ | Your app's public URL |
| `MONITOR_CHANNEL_SECRET` | ✅ | Secret for webhook signatures |
| `ENABLE_MONITORS_UI` | ❌ | Show monitoring UI (default: false) |
| `ENABLE_PROBE_SCHEDULER` | ❌ | Start probe scheduler (default: false) |
| `ENABLE_PROBE_WORKER` | ❌ | Start probe worker (default: false) |
| `ENABLE_NOTIFICATIONS` | ❌ | Enable notifications (default: false) |
| `RESEND_API_KEY` | ❌ | Resend API key for emails |
| `BLACKBOX_BASE_URL` | ❌ | Blackbox Exporter URL |

## Contributing

See `CLAUDE.md` for development guidelines and architecture details.

## License

MIT
