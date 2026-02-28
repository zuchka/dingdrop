# Railway Deployment Configuration

This directory contains Railway-specific configuration and documentation.

## Required Environment Variables

Set these in your Railway service settings:

### Essential Variables

- `DATABASE_URL` - PostgreSQL connection string (automatically set by Railway Postgres service)
- `SESSION_SECRET` - Random secret for session signing (min 32 characters)
- `MONITOR_CHANNEL_SECRET` - Random secret for webhook signatures (min 32 characters)
- `APP_BASE_URL` - Your app's public URL (use `${{RAILWAY_PUBLIC_DOMAIN}}` or your custom domain)

### Monitoring Features (Optional)

To enable the monitoring subsystem, set these to `true`:

- `ENABLE_MONITORS_UI=true` - Show monitoring UI routes
- `ENABLE_PROBE_SCHEDULER=true` - Start background probe scheduler
- `ENABLE_PROBE_WORKER=true` - Start probe executor
- `ENABLE_NOTIFICATIONS=true` - Enable notification dispatcher
- `PROBE_EXECUTOR=fetch` - Use native fetch (recommended for Railway)

### Email Notifications (Optional)

For email alerts via Resend:

- `RESEND_API_KEY` - Your Resend API key
- `RESEND_FROM_EMAIL` - Verified sender email address

## Generate Secure Secrets

```bash
# Using OpenSSL:
openssl rand -base64 32

# Using Node.js:
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

## Blackbox Exporter (Advanced)

If you prefer to use Prometheus Blackbox Exporter instead of native fetch:

1. Add a new service to your Railway project
2. Use Docker image: `prom/blackbox-exporter:latest`
3. Set environment variables:
   - `PROBE_EXECUTOR=blackbox`
   - `BLACKBOX_BASE_URL=http://<blackbox-service-name>:9115`

## Configuration Files

- `../railway.json` - Railway deployment configuration using Railpack builder
- `../blackbox.yml` - Blackbox Exporter configuration (if using)

## Deployment Process

1. **Build Phase:**
   - Installs dependencies (`npm ci`)
   - Generates Prisma client
   - Builds the Remix application

2. **Pre-Deploy:**
   - Runs database migrations (`prisma migrate deploy`)

3. **Deploy:**
   - Starts the production server
   - Health checks endpoint: `/`
   - Restarts on failure (max 10 retries)
