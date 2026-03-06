# PCG — Production Upgrade: Audit Report & Migration Guide

## Bugs Fixed

### 🔴 Critical

| # | File | Issue | Fix |
|---|------|-------|-----|
| 1 | `middleware/auth.ts` | `requireProjectAccess` only checked `ownerId`, completely locking out IAM-granted collaborators | Now checks IAM membership table as a fallback |
| 2 | `routes/auth.ts` | `createSession` was non-atomic: created a placeholder session, signed JWT, then updated — risked DB inconsistency | Session and RefreshToken are created in a single `$transaction` |
| 3 | `routes/announcements.ts` | Any authenticated user could create announcements | Guarded with `requireAdmin` |
| 4 | `routes/improvements.ts` | `PatchImprovementSchema.refine` used `d.vote \|\| d.status \|\| d.priority`; `{ vote: false }` would silently fail | Fixed to `d.vote === true \|\| d.status !== undefined \|\| d.priority !== undefined` |
| 5 | `routes/improvements.ts` | No vote deduplication — users could upvote unlimited times | New `UserVote` model enforces one vote per user per improvement at DB level |
| 6 | `lib/prisma.ts` | Circular dependency: `prisma.ts → server.ts → prisma.ts` (logger import) | Logger extracted to `lib/logger.ts` |

### 🟠 Security

| # | Issue | Fix |
|---|-------|-----|
| 7 | No brute-force protection on `/auth/login` and `/register` | Auth-specific rate limiter: 10 failures/min per IP |
| 8 | `req.ip` was unreliable behind reverse proxies | `app.set("trust proxy", env.TRUST_PROXY)` configurable per environment |
| 9 | JWT tokens were long-lived (7 days) with no refresh mechanism | Short-lived access tokens (15 min) + rotating refresh tokens (30 days) |
| 10 | Login timing attack: failed lookups short-circuited before bcrypt | Now always runs bcrypt compare (against dummy hash on miss) |
| 11 | Any user could change improvement status/priority | `status`/`priority` changes gated behind `requireAdmin` |
| 12 | Sensitive fields could appear in logs | Added Pino `redact` config for `authorization`, `password`, `passwordHash` |

### 🟡 Performance

| # | File | Issue | Fix |
|---|------|-------|-----|
| 13 | `workers/metricsWorker.ts` | N+1: one `UPDATE` per VM per tick | All VM updates + project spend increments batched in one `$transaction` |
| 14 | `workers/metricsWorker.ts` | No tick overlap guard; slow ticks could pile up | Added `isRunning` guard: skips tick if previous one is still in progress |
| 15 | `store/index.ts` | `loadVMs` reset `vms = []` before fetching, causing UI flicker | Data is only replaced after fetch completes |
| 16 | `middleware/auth.ts` | Missing index on `IAMMember.email` | Added `@@index([email])` to Prisma schema |

---

## New Features

### 🔑 Rotating Refresh Tokens
- Access tokens: 15-minute lifetime (configurable via `JWT_EXPIRES_IN`)
- Refresh tokens: 30-day lifetime (configurable via `JWT_REFRESH_EXPIRES_IN`)
- Token rotation on every refresh — old token immediately revoked
- Automatic silent refresh in `apiClient.ts` on 401 responses

### New endpoints:
```
POST /api/v1/auth/refresh          → { accessToken, refreshToken, expiresAt }
POST /api/v1/auth/change-password  → invalidates all existing sessions
```

### 📋 Cursor-Based Pagination
All list endpoints now support cursor pagination:
```
GET /api/v1/announcements?limit=20&cursor=<id>
GET /api/v1/improvements?limit=20&cursor=<id>&status=planned
GET /api/v1/logs/:projectId?limit=50&cursor=<id>
```
Response includes `meta: { hasNextPage, nextCursor }`.

### 🛡️ Admin Role System
- Set `ADMIN_EMAILS=admin@domain.com` in `.env`
- `requireAdmin` middleware blocks non-admins
- Admins can: create/edit/delete all announcements, change improvement status/priority
- Non-admins: can still submit improvements and upvote

### 🏥 Enhanced Health Check
```
GET /health
→ { status: "ok"|"degraded", checks: { database: "ok"|"error" }, version, ts }
```
Returns HTTP 503 if the database is unreachable.

### 🗳️ Vote Deduplication
- New `UserVote` DB table: `@@unique([userId, improvementId])`
- Client-side optimistic updates with rollback on server error
- `useHasVotedFor(id)` selector for disabling vote buttons
- Persisted vote set survives page refresh

### 🔐 Password Change
- `POST /api/v1/auth/change-password` requires current password
- Revokes all existing sessions on success
- Password policy: min 8 chars, 1 uppercase, 1 number

---

## Migration Steps

### 1. Database Schema
```bash
# Preferred: let Prisma generate the migration
npx prisma migrate dev --name "refresh_tokens_vote_dedup"

# Or apply the raw SQL manually
psql $DATABASE_URL -f apps/api/prisma/migration.sql
```

### 2. New Environment Variables
Add to `.env`:
```bash
JWT_REFRESH_SECRET=<new-32-char-secret>
JWT_REFRESH_EXPIRES_IN=30d
JWT_EXPIRES_IN=15m           # was 7d — reduce access token lifetime
ADMIN_EMAILS=your@email.com
TRUST_PROXY=1
```

### 3. Frontend Token Storage
The API now returns `accessToken` and `refreshToken` (not just `token`).
Update any login/register call sites:
```ts
// Before
localStorage.setItem("pcg_token", result.token);
// After — handled automatically by storeTokens() in apiClient.ts
storeTokens(result.accessToken, result.refreshToken);
```

### 4. Existing Sessions
After deploying, existing DB sessions use the old long-lived JWT format.
To force all users to re-authenticate (recommended):
```sql
DELETE FROM "Session";
```

---

## File Changelog

| File | Status |
|------|--------|
| `apps/api/src/lib/logger.ts` | **NEW** — extracted from server.ts |
| `apps/api/src/lib/env.ts` | **UPDATED** — new JWT_REFRESH_*, ADMIN_EMAILS, TRUST_PROXY vars |
| `apps/api/src/lib/prisma.ts` | **UPDATED** — fixed circular dep, added `checkDatabaseConnection()` |
| `apps/api/src/server.ts` | **UPDATED** — graceful shutdown, trust proxy, auth rate limiter, DB health check |
| `apps/api/src/middleware/auth.ts` | **UPDATED** — IAM membership check, `requireAdmin`, error handling |
| `apps/api/src/middleware/errorHandler.ts` | **UPDATED** — uses lib/logger (no longer circular) |
| `apps/api/src/routes/auth.ts` | **UPDATED** — refresh, change-password, atomic session, timing-safe login |
| `apps/api/src/routes/vms.ts` | **UPDATED** — typed action enum, improved error messages |
| `apps/api/src/routes/announcements.ts` | **UPDATED** — pagination, admin guard, PATCH endpoint |
| `apps/api/src/routes/improvements.ts` | **UPDATED** — pagination, vote dedup, admin guard, delete endpoint |
| `apps/api/prisma/schema.prisma` | **UPDATED** — RefreshToken, UserVote, Improvement.authorEmail, new indexes |
| `apps/api/prisma/migration.sql` | **NEW** — raw SQL migration for existing databases |
| `apps/api/.env.example` | **UPDATED** — new env vars documented |
| `apps/api/src/workers/metricsWorker.ts` | **UPDATED** — batched transaction, overlap guard |
| `packages/shared/src/index.ts` | **UPDATED** — PaginatedMeta, PaginatedResponse types |
| `apps/web/src/lib/apiClient.ts` | **UPDATED** — token refresh, pagination, change-password |
| `apps/web/src/store/index.ts` | **UPDATED** — refresh tokens, pagination state, vote dedup, no-flicker loads |
