# PCG Platform — Setup Guide & Enhanced Audit Report

## Quick Start

### Option A: One-Command Setup (Recommended)

```bash
# Clone or extract the project, then:
bash setup.sh          # local dev (requires Postgres running)
bash setup.sh docker   # Docker dev (self-contained, no prerequisites except Docker)
```

The script will install dependencies, generate JWT secrets, build packages, run migrations, and tell you when everything is ready.

### Option B: Manual Setup

#### Prerequisites

| Tool | Version | Purpose |
|------|---------|---------|
| Node.js | 18+ | Runtime |
| npm | 9+ | Package manager |
| PostgreSQL | 14+ | Database |
| Redis | 7+ | Rate limiting (optional) |

#### Step 1 — Install Dependencies

```bash
npm install                         # installs all workspaces
npm run -w packages/shared build    # build shared types first
```

#### Step 2 — Configure Environment

```bash
cp apps/api/.env.example apps/api/.env
```

Generate JWT secrets:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Paste the output into `apps/api/.env` for both `JWT_SECRET` and `JWT_REFRESH_SECRET` (generate two separate values).

Required environment variables:

| Variable | Example | Notes |
|----------|---------|-------|
| `DATABASE_URL` | `postgresql://pcg:pcg_dev_pass@localhost:5432/pcg_db` | Postgres connection string |
| `JWT_SECRET` | 64-char hex | Signs access tokens (15 min TTL) |
| `JWT_REFRESH_SECRET` | 64-char hex | Signs refresh tokens (30 day TTL) |
| `ANTHROPIC_API_KEY` | `sk-ant-...` | For AI features |
| `ADMIN_EMAILS` | `you@domain.com` | Comma-separated admin list |
| `CORS_ORIGINS` | `http://localhost:3000` | Frontend URL(s) |

Optional:

| Variable | Default | Notes |
|----------|---------|-------|
| `JWT_EXPIRES_IN` | `15m` | Access token lifetime |
| `JWT_REFRESH_EXPIRES_IN` | `30d` | Refresh token lifetime |
| `TRUST_PROXY` | `1` | Set to `0` if not behind a proxy |
| `REDIS_URL` | — | Optional caching layer |
| `LOG_LEVEL` | `info` | `fatal\|error\|warn\|info\|debug\|trace` |

#### Step 3 — Database

Start Postgres (if not running):

```bash
# Quick: Docker one-liner
docker run -d --name pcg-postgres \
  -e POSTGRES_USER=pcg \
  -e POSTGRES_PASSWORD=pcg_dev_pass \
  -e POSTGRES_DB=pcg_db \
  -p 5432:5432 \
  postgres:16-alpine
```

Run migrations:

```bash
cd apps/api
npx prisma generate         # generate client
npx prisma migrate dev      # apply schema + create migration
# OR for existing databases:
npx prisma db push          # push schema without migration files
```

Verify with Prisma Studio:

```bash
npx prisma studio           # opens browser UI at localhost:5555
```

#### Step 4 — Start Development

```bash
npm run dev                  # starts everything via Turborepo
```

Or start services individually:

```bash
npm run -w @pcg/api dev          # API → http://localhost:4000
npm run -w @pcg/api dev:worker   # Metrics worker (10s tick)
npm run -w @pcg/web dev          # Web → http://localhost:3000
```

Verify: `curl http://localhost:4000/health`

```json
{ "status": "ok", "checks": { "database": "ok" }, "uptime": 12.5 }
```

### Option C: Docker Compose

```bash
cd infra/docker

# Set required secrets (or let setup.sh generate them)
export ANTHROPIC_API_KEY=sk-ant-...
export JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
export JWT_REFRESH_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")

docker compose up -d --build
```

Services started:

| Service | Port | Container |
|---------|------|-----------|
| API | 4000 | pcg-api |
| Web | 3000 | pcg-web |
| Postgres | 5432 | pcg-postgres |
| Redis | 6379 | pcg-redis |
| Metrics Worker | — | pcg-metrics-worker |

---

## Architecture Overview

```
pcg-simulator/                    (Turborepo monorepo)
├── packages/shared/              Shared types, Zod schemas, constants
├── apps/api/                     Express + Prisma API
│   ├── prisma/schema.prisma      Database schema (16 models)
│   ├── src/
│   │   ├── lib/                  env, logger, prisma client
│   │   ├── middleware/           auth, errors, rate limiting, request ID
│   │   ├── routes/               10 route modules
│   │   ├── services/             billing, simulation, subscriptions, logging
│   │   └── workers/              metrics worker (separate process)
│   └── .env
├── apps/web/                     Next.js frontend
│   ├── src/
│   │   ├── hooks/                billing clock, metrics polling, session timer
│   │   ├── lib/apiClient.ts      typed API client with auto-refresh
│   │   └── store/index.ts        Zustand + Immer global store
│   └── ...
└── infra/docker/                 Dockerfiles + compose
```

---

## Enhanced Audit — Additional Fixes (v2.1)

The following issues were found and fixed beyond the original v2.0 audit.

### Critical Bugs Fixed

| # | File | Issue | Fix |
|---|------|-------|-----|
| 17 | `server.ts` ↔ `auth.ts` | **Circular dependency**: `auth.ts` imported `authLimiter` from `server.ts`, which imports `authRouter` from `auth.ts`. At runtime, `authLimiter` could be `undefined` depending on module resolution order. | Extracted all rate limiters to `middleware/rateLimiter.ts`. Both `server.ts` and `auth.ts` now import from this new module. |
| 18 | `docker-compose.yml` | **Missing env vars**: API container was missing `JWT_REFRESH_SECRET`, `JWT_REFRESH_EXPIRES_IN`, `JWT_EXPIRES_IN`, `ADMIN_EMAILS`, and `TRUST_PROXY`. Metrics worker was missing `JWT_SECRET`, `JWT_REFRESH_SECRET`, and `ANTHROPIC_API_KEY` (needed to pass env validation). Server would crash on startup. | Added all required variables with sensible defaults via `${VAR:-default}` syntax. |
| 19 | `improvements.ts` | **Vote + update not transactional**: Vote creation (`UserVote.create`) and vote count increment (`Improvement.update`) were separate queries. If the update failed, the UserVote row persisted — user could never retry. | Wrapped vote creation + count increment in a `$transaction`. Status/priority updates are a separate query only when needed. |
| 20 | `apiClient.ts` | **`apiFetchPaged` missing auth handling**: Unlike `apiFetch`, the paginated wrapper had no 401 token-refresh or 429 rate-limit-retry logic. Paginated endpoints would fail silently when tokens expired. | Added full 401 refresh + 429 retry logic mirroring `apiFetch`. |
| 21 | `server.ts` | **6 missing route files**: `server.ts` imported `projectsRouter`, `storageRouter`, `sqlRouter`, `iamRouter`, `logsRouter`, `metricsRouter` — none existed in the codebase. Server would crash on startup. | Created all 6 route modules with full CRUD operations matching the Prisma schema. |

### Security Fixes

| # | Issue | Fix |
|---|-------|-----|
| 22 | Refresh endpoint had no rate limiting — attacker could brute-force refresh tokens at unlimited speed | Added `refreshLimiter` (20 req/min) and Zod schema validation to `/auth/refresh` |
| 23 | `authLimiter` used `skipSuccessfulRequests: true` — attacker could enumerate valid emails via successful login probes without hitting rate limit | Changed to `skipSuccessfulRequests: false` — all attempts count toward the limit |
| 24 | Expired sessions and revoked refresh tokens accumulated forever in the database | Added session cleanup cron (every 6 hours) that purges expired sessions and tokens revoked more than 7 days ago |

### Code Quality / DX Fixes

| # | Issue | Fix |
|---|-------|-----|
| 25 | `metricsWorker.ts` created its own `pino()` logger instead of using the shared `lib/logger.ts` — different redaction config, format, level | Now imports from `lib/logger.ts` |
| 26 | No `tsconfig.json` files included — TypeScript compilation would fail | Created `tsconfig.json` for root, `apps/api`, `apps/web`, and `packages/shared` with proper path mappings |
| 27 | No `.gitignore` — risk of committing `node_modules`, `.env`, build artifacts | Created comprehensive `.gitignore` |
| 28 | No `Dockerfile.web` — referenced in `docker-compose.yml` but missing | Created multi-stage Dockerfile with dev target for compose and production target for deployment |
| 29 | Health endpoint logged every 5s via pino-http, flooding dev logs | Added `autoLogging.ignore` filter to skip `/health` requests |
| 30 | No automated setup script — manual multi-step process prone to errors | Created `setup.sh` with auto-secret-generation, dependency installation, migration, and both local and Docker modes |

---

## Database Schema Migration

If upgrading from v1 (pre-audit), run the migration:

```bash
# Preferred: Prisma-managed migration
cd apps/api
npx prisma migrate dev --name "refresh_tokens_vote_dedup"

# OR: Raw SQL for existing production databases
psql $DATABASE_URL -f apps/api/prisma/migration.sql
```

This adds: `RefreshToken` table, `UserVote` table, `Improvement.authorEmail` column, and indexes on `IAMMember.email` and `Session.expiresAt`.

After deploying, force all users to re-authenticate:

```sql
DELETE FROM "Session";
UPDATE "RefreshToken" SET "revokedAt" = NOW() WHERE "revokedAt" IS NULL;
```

---

## API Endpoints Reference

### Auth

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/v1/auth/register` | — | Create account (rate limited) |
| POST | `/api/v1/auth/login` | — | Sign in (rate limited) |
| POST | `/api/v1/auth/refresh` | — | Rotate tokens (rate limited) |
| POST | `/api/v1/auth/logout` | Bearer | Revoke session + refresh tokens |
| GET | `/api/v1/auth/me` | Bearer | Current user + projects + quota |
| POST | `/api/v1/auth/change-password` | Bearer | Change password, revoke all sessions |

### Resources

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/v1/projects` | Bearer | List user's projects |
| GET/POST/PATCH | `/api/v1/vms/:projectId` | Bearer + Project | VM CRUD |
| PATCH | `/api/v1/vms/:projectId/:vmId/action` | Bearer + Project | start/stop/suspend/terminate |
| GET/POST/DELETE | `/api/v1/storage/:projectId/buckets` | Bearer + Project | Storage CRUD |
| GET/POST/DELETE | `/api/v1/sql/:projectId` | Bearer + Project | Cloud SQL CRUD |
| GET/POST/DELETE | `/api/v1/iam/:projectId` | Bearer + Project | IAM members |
| GET | `/api/v1/logs/:projectId` | Bearer + Project | Activity logs (paginated) |
| GET | `/api/v1/metrics/:projectId` | Bearer + Project | Aggregate metrics |

### Community

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/v1/announcements` | — | List (paginated) |
| POST/PATCH/DELETE | `/api/v1/announcements/:id` | Admin | Manage announcements |
| GET | `/api/v1/improvements` | — | List (paginated, filterable) |
| POST | `/api/v1/improvements` | Bearer | Submit improvement |
| PATCH | `/api/v1/improvements/:id` | Bearer | Vote (any user) or change status (admin) |

---

## Production Deployment Checklist

- [ ] Generate unique 32+ character secrets for `JWT_SECRET` and `JWT_REFRESH_SECRET`
- [ ] Set `NODE_ENV=production`
- [ ] Set `TRUST_PROXY` to match your proxy chain depth
- [ ] Set `CORS_ORIGINS` to your actual frontend domain(s)
- [ ] Set `ADMIN_EMAILS` to your ops team
- [ ] Run `npx prisma migrate deploy` (not `dev`) in production
- [ ] Set `LOG_LEVEL=info` or `warn`
- [ ] Configure health check monitoring on `/health`
- [ ] Set up database backups
- [ ] Review rate limit thresholds for your traffic
