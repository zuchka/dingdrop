# Dingdrop MVP Implementation Plan

## 1. Goals, Scope, and Decisions

### 1.1 Product Goal
Ship a production-usable MVP for a multi-tenant webhook inbox + inspector where users can:
1. Sign up and create an org.
2. Create endpoints with unique ingestion URL + secret.
3. Send webhooks to an ingestion route.
4. Inspect captured requests in an inbox/detail UI.
5. Replay requests to a target URL.

### 1.2 In-Scope (MVP)
1. Auth + session management.
2. Org/member/endpoint data model.
3. Public ingestion route with secret verification.
4. Request capture + storage (headers, raw body, parsed JSON when possible, metadata).
5. Endpoint inbox + request detail UI.
6. Replay action + replay attempt logging.
7. Basic UX polish (copy buttons, cURL generation, empty states, timestamps).
8. Basic safety controls (size limit, header allowlist on replay, redaction toggle).

### 1.3 Out of Scope (Design for Later)
1. Transform rule engine.
2. Provider-specific HMAC signature verification presets.
3. Advanced roles/permissions, billing, retention policy management UI.
4. Real-time streaming updates.

### 1.4 Baseline Decisions
1. ORM: Prisma.
2. Auth method: Email + password (bcrypt) for fastest MVP.
3. Runtime: Node 20+ (native `fetch` and `AbortController` for replay).
4. DB: Postgres.
5. Body size limit: 1 MB configurable constant.

---

## 2. High-Level Architecture

### 2.1 Layers
1. **Route layer**: Remix loaders/actions/routes.
2. **Domain/service layer**: org/endpoint/request/replay/auth services.
3. **Data layer**: Prisma client and repository helpers.
4. **UI layer**: shadcn components for list/detail/forms/tables/tabs.
5. **Utility layer**: key generation, cURL generation, redaction, replay header filtering.

### 2.2 Core Domains
1. Identity: User + Session.
2. Tenancy: Org + Membership.
3. Ingestion: Endpoint + WebhookRequest.
4. Delivery: ReplayAttempt.

### 2.3 Extensibility Hook (MVP scaffold only)
Route ingestion through:
1. `normalizeIncomingWebhook(...)`
2. `applyTransforms(...)` (no-op in MVP)
3. `storeWebhook(...)`

---

## 3. Repository and Module Structure

## 3.1 Suggested Structure
```text
app/
  components/
    ui/                       # shadcn generated components
    endpoint/
    request/
  lib/
    auth.server.ts
    session.server.ts
    db.server.ts
    env.server.ts
    constants.ts
    security.ts
    utils/
      endpoint-keys.ts
      curl.ts
      redact.ts
      format.ts
  models/                     # DB-facing query helpers by aggregate
    user.server.ts
    org.server.ts
    endpoint.server.ts
    webhook-request.server.ts
    replay.server.ts
  services/                   # domain-level orchestration
    ingestion.server.ts
    replay.server.ts
  routes/
    _index.tsx
    login.tsx
    signup.tsx
    logout.tsx
    app.tsx
    app.orgs.tsx
    app.orgs.new.tsx
    app.orgs.$orgSlug.endpoints.tsx
    app.orgs.$orgSlug.endpoints.new.tsx
    app.orgs.$orgSlug.endpoints.$endpointId.tsx
    app.orgs.$orgSlug.endpoints.$endpointId.requests.$requestId.tsx
    app.orgs.$orgSlug.endpoints.$endpointId.requests.$requestId.replay.tsx
    i.$endpointKey.tsx
prisma/
  schema.prisma
  migrations/
```

---

## 4. Step-by-Step Execution Plan

## Phase 0: Project Initialization (Day 1)
1. Create Remix + Vite project.
2. Add Tailwind + shadcn/ui setup.
3. Add Prisma + Postgres config.
4. Add baseline env handling (`DATABASE_URL`, `SESSION_SECRET`, `APP_BASE_URL`).
5. Configure linting and formatting.

### Deliverables
1. App boots locally.
2. DB connection passes.
3. Base app layout and UI primitives available.

### Exit Criteria
1. `npm run dev` works.
2. `prisma migrate dev` works.

---

## Phase 1: Data Model + Migrations (Day 1)
1. Implement Prisma schema for `User`, `Org`, `OrgMember`, `Endpoint`, `WebhookRequest`, `ReplayAttempt`.
2. Add indexes exactly as defined in MVP model.
3. Run and commit first migration.
4. Add `prisma generate` in setup flow.

### Deliverables
1. Schema checked in.
2. Migration files checked in.

### Exit Criteria
1. Tables exist and constraints work (`@@unique`, `@@index`, cascades).

---

## Phase 2: Authentication + Session Foundation (Day 1-2)
1. Build signup route:
1. Validate email/password.
2. Hash password with bcrypt.
3. Create user.
2. Build login route:
1. Verify credentials.
2. Create session cookie.
3. Build logout action.
4. Build shared auth guards:
1. `requireUserId(request)`.
2. `getUserId(request)`.
5. Add route protections for `/app/**`.

### Deliverables
1. Login/signup/logout pages.
2. Session-based auth for app routes.

### Exit Criteria
1. Unauthenticated users are redirected from `/app`.
2. Authenticated users can persist session across refresh.

---

## Phase 3: Multi-Tenancy Core (Day 2)
1. Org creation flow after first signup.
2. Org switcher route `/app/orgs`.
3. Membership enforcement helpers:
1. `requireOrgMember(userId, orgSlug)`.
2. Query only org-scoped endpoints and requests.
4. Default `/app` redirect to first org.

### Deliverables
1. User can create org and view org list.
2. Access control on org-scoped routes.

### Exit Criteria
1. Cross-org access attempts return 403/redirect.

---

## Phase 4: Endpoint CRUD + Keys/Secrets (Day 2-3)
1. Implement endpoint create route/form:
1. Name input.
2. Generate `key` + `secret`.
2. Endpoint list route:
1. Name.
2. Ingestion URL.
3. Last request time.
4. Last-24h request count.
3. Endpoint settings tab:
1. Active/inactive toggle.
2. Default replay URL field.
4. Utilities:
1. `generateEndpointKey()`.
2. `generateEndpointSecret()`.

### Deliverables
1. Endpoint list and create flows.
2. Copy ingestion URL/secret UI control.

### Exit Criteria
1. Newly created endpoint has unique key and secret.

---

## Phase 5: Ingestion Route (Critical Path) (Day 3)
1. Add public route: `/i/:endpointKey` accepting any method.
2. Lookup endpoint by key and verify active state.
3. Authenticate using:
1. `x-dingdrop-secret` header, or
2. `?secret=` query param.
4. Read raw bytes with `request.arrayBuffer()`.
5. Enforce max body size.
6. Collect request metadata:
1. method, path, query params, headers.
2. content-type, ip, user-agent, size bytes.
7. Parse text and parse JSON when applicable.
8. Save record in `WebhookRequest`.
9. Respond `{ ok: true, requestId }`.

### Deliverables
1. Ingestion endpoint fully operational.
2. Error responses for bad secret/inactive endpoint/body too large.

### Exit Criteria
1. Test webhook appears in DB with complete metadata.
2. Invalid secret returns 401.
3. Oversized payload returns 413.

---

## Phase 6: Inbox UI (Day 3-4)
1. Implement endpoint inbox tab route.
2. Query last 500 requests by `receivedAt DESC`.
3. Render table with:
1. Method badge.
2. Captured status badge.
3. Received time.
4. Content type.
5. Size.
4. Add basic filter inputs (method/content-type).
5. Add empty states.

### Deliverables
1. Functional request inbox table.

### Exit Criteria
1. New ingested request is visible in inbox after refresh.

---

## Phase 7: Request Detail UI (Day 4)
1. Build detail route:
`/app/orgs/:orgSlug/endpoints/:endpointId/requests/:requestId`.
2. Tabs:
1. Body (pretty JSON + raw text view).
2. Headers table.
3. Meta (IP, UA, size, time, query).
3. Add “Copy as cURL” button.
4. Add redaction toggle (mask likely secrets via regex heuristics).

### Deliverables
1. Full request inspection experience.

### Exit Criteria
1. User can inspect any captured request fields.

---

## Phase 8: Replay System (Day 4-5)
1. Add replay form/action on request detail.
2. Replay target URL resolution:
1. explicit form input, else
2. endpoint default replay URL.
3. Forward request with:
1. original method.
2. original body bytes.
3. allowed headers only.
4. Timeout with `AbortController`.
5. Capture response status and duration.
6. Log each attempt in `ReplayAttempt`.
7. Show replay attempt history on detail page.

### Deliverables
1. Replay button works and logs attempts.

### Exit Criteria
1. Successful replay returns `ok=true` log entry.
2. Failed replay stores error message and timing.

---

## Phase 9: Security + Guardrails (Day 5)
1. Secret comparison helper (MVP simple compare; keep a single function for later constant-time upgrade).
2. Enforce endpoint active flag in ingestion.
3. Reject overly large payloads.
4. Replay header allowlist:
1. keep `content-type`.
2. optionally keep `user-agent`.
3. drop `host`, `content-length`, auth headers by default.
5. Centralize safe defaults in constants.

### Deliverables
1. Security baseline complete.

### Exit Criteria
1. Manual verification of blocked headers and size limit.

---

## Phase 10: UX Polish + Quality (Day 5-6)
1. Relative/absolute timestamp formatting.
2. Copy controls for ingestion URL, secret, cURL.
3. Better loading and empty states.
4. Add toasts for success/error actions.
5. Ensure mobile table fallbacks (horizontal scroll/cards).

### Deliverables
1. MVP feels complete and usable.

### Exit Criteria
1. End-to-end demo flow is smooth without UI blockers.

---

## 5. Detailed Route-by-Route Checklist

### Public Routes
1. `/` landing page + CTA.
2. `/signup` create account.
3. `/login` authenticate.
4. `/logout` destroy session.

### App Routes (Auth Required)
1. `/app` redirect to first org.
2. `/app/orgs` org list + create.
3. `/app/orgs/:orgSlug/endpoints` endpoint list.
4. `/app/orgs/:orgSlug/endpoints/new` endpoint create form.
5. `/app/orgs/:orgSlug/endpoints/:endpointId` endpoint page with tabs.
6. `/app/orgs/:orgSlug/endpoints/:endpointId/requests/:requestId` request detail.
7. Replay action route for request replay.

### Ingestion
1. `/i/:endpointKey` capture and store request.

---

## 6. Service-Level Implementation Tasks

### 6.1 Auth Service
1. Password hashing and verification.
2. Session create/read/destroy.
3. Route guards.

### 6.2 Org Service
1. Create org.
2. Add creator as admin member.
3. Resolve org by slug with membership checks.

### 6.3 Endpoint Service
1. Create endpoint with generated key/secret.
2. Update endpoint settings (`isActive`, `defaultReplayUrl`).
3. Stats query for last request + 24h count.

### 6.4 Ingestion Service
1. Endpoint lookup + secret verification.
2. Request normalization.
3. Transform no-op hook.
4. Persist webhook request.

### 6.5 Replay Service
1. Build outbound request from stored webhook.
2. Filter headers with allowlist.
3. Execute replay with timeout.
4. Persist attempt log.

---

## 7. Testing Plan (Minimum but Meaningful)

## 7.1 Unit Tests
1. Key/secret generation format and uniqueness heuristics.
2. cURL generator quoting.
3. Redaction utility regex behavior.
4. Replay header filtering.

## 7.2 Integration Tests
1. Signup/login/session flow.
2. Org creation and membership enforcement.
3. Endpoint creation.
4. Ingestion success and failure paths (bad secret, inactive endpoint, size limit).
5. Replay success/failure logging.

## 7.3 Manual End-to-End Script
1. Create account.
2. Create org.
3. Create endpoint.
4. Send sample JSON webhook with secret.
5. Confirm inbox entry.
6. Open request detail and inspect tabs.
7. Replay to test target.
8. Confirm replay attempt log.

---

## 8. Operational Defaults and Config

1. `MAX_WEBHOOK_BODY_BYTES=1048576`
2. `INBOX_QUERY_LIMIT=500`
3. `REPLAY_TIMEOUT_MS=10000`
4. `REPLAY_ALLOWED_HEADERS=content-type,user-agent`
5. `APP_BASE_URL=https://ding.ing` (env by deployment stage)

---

## 9. Risk Register and Mitigations

1. **Large payload memory pressure**
Mitigation: hard body-size cap and early rejection.
2. **Tenant data leakage**
Mitigation: enforce org membership in every app route query path.
3. **Replay abuse of sensitive headers**
Mitigation: strict allowlist and explicit opt-in for additional headers later.
4. **Schema churn while building quickly**
Mitigation: keep service boundaries and migration discipline from day one.

---

## 10. Definition of Done (MVP)

1. New user can sign up, create org, create endpoint.
2. Ingestion URL accepts webhook and stores complete request record.
3. Endpoint inbox displays captured requests with key metadata.
4. Request detail page exposes body/headers/meta and cURL copy.
5. Replay action forwards request to target and stores attempt logs.
6. Basic security controls (secret check, body limit, replay header filtering) are active.
7. Core routes are covered by integration tests and pass.

---

## 11. Post-MVP Ready Hooks (Implemented as Stubs/Interfaces)

1. `applyTransforms(normalized, endpoint)` no-op for now.
2. Signature verifier interface with provider adapters to add later.
3. Retention job interface (delete old requests by endpoint policy).
4. Real-time transport abstraction (polling now, websockets later).

---

## 12. Suggested Build Cadence (6 Working Days)

1. Day 1: Scaffold, Prisma schema, migrations.
2. Day 2: Auth + org membership + route guards.
3. Day 3: Endpoint CRUD + ingestion route.
4. Day 4: Inbox + request detail.
5. Day 5: Replay + security pass.
6. Day 6: Polish, tests, launch checklist.

