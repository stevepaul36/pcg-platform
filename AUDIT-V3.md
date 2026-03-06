# PCG Platform v3.0.0 — Production Audit Report

**Audit date:** 2026-02-28  
**Scope:** Full codebase review — all 47 source files (4,383 LOC)  
**Previous version:** v2.0.0 (enhanced from original v1)

---

## Executive Summary

Deep audit of the v2 enhanced codebase revealed **14 issues** across bug, security, missing feature, and DX categories. All have been resolved in v3.0.0. The most critical finding was a **BigInt JSON serialization crash** that would cause 500 errors on any storage-related API response in production.

---

## Critical Bugs Fixed

### #31 — BigInt JSON Serialization Crash
- **Severity:** CRITICAL — production runtime crash
- **Location:** `StorageBucket.totalSizeBytes`, `StorageObject.sizeBytes`
- **Impact:** Any `GET /storage/:projectId/buckets` call throws `TypeError: Do not know how to serialize a BigInt` because Express's `res.json()` calls `JSON.stringify()` which cannot serialize BigInt values
- **Fix:** Added `apps/api/src/lib/bigintPatch.ts` — patches `BigInt.prototype.toJSON` to return safe numbers or strings. Imported as first line in `server.ts`

### #32 — Docker Web Service Builds Wrong Target
- **Severity:** HIGH — Docker dev environment non-functional
- **Location:** `infra/docker/docker-compose.yml` → `web` service
- **Impact:** Without `target: dev`, Docker builds the production runner stage which expects `.next/standalone` output — but `next.config.js` didn't even exist (see #33). Result: web container crashes on startup
- **Fix:** Added `target: dev` to web service build config

### #33 — Missing next.config.js
- **Severity:** HIGH — Docker production build fails
- **Location:** `apps/web/` (file didn't exist)
- **Impact:** Three cascading failures: (1) No `output: "standalone"` means Docker production build crashes, (2) No `transpilePackages` means `@pcg/shared` TypeScript imports fail, (3) No API rewrites for dev proxy
- **Fix:** Created `apps/web/next.config.js` with standalone output, workspace transpilation, API rewrites, and security hardening

---

## Missing Features Implemented

### #34 — Database Seed Script
- **Location:** `apps/api/src/db/seed.ts` (referenced in `package.json` but didn't exist)
- **Impact:** New developers had to manually create test data — friction for onboarding
- **Fix:** Full seed script that creates: 2 users (admin + demo), 1 project, 3 VMs, 1 bucket with objects, 1 SQL instance, 6 activity logs, 2 announcements, 5 improvements
- **Usage:** `npm run db:seed`

### #35-38 — Missing Pagination on Resource Lists
- **Location:** `vms.ts`, `storage.ts`, `sql.ts`, `iam.ts`
- **Impact:** All four endpoints returned unbounded `findMany()` results — works in dev but causes timeout/OOM with production-scale data (100+ VMs, buckets, etc.)
- **Fix:** Added cursor-based pagination with configurable `limit` (max 200) and optional `status` filter on VMs. All four now return `{ data, meta: { hasNextPage, nextCursor } }`

### #39 — Password Reset Flow
- **Location:** `auth.ts` (endpoints), `schema.prisma` (model), `apiClient.ts` (client)
- **Impact:** Users who forgot their password had zero recovery path — locked out permanently
- **Fix:** Two new endpoints:
  - `POST /auth/forgot-password` — generates time-limited token (1 hour), always returns 200 to prevent email enumeration
  - `POST /auth/reset-password` — consumes token, sets new password, revokes all sessions atomically
- **Schema:** New `PasswordReset` model with token, expiry, usage tracking
- **Security:** Expired/used tokens cleaned up by session cleanup cron

### #43 — Project Create & Delete
- **Location:** `projects.ts` (endpoints), `apiClient.ts` (client)
- **Impact:** Users could only have the auto-created registration project — no way to create additional projects or delete unused ones
- **Fix:** 
  - `POST /api/v1/projects` — create project (max 5 per user)
  - `DELETE /api/v1/projects/:id` — owner-only delete, refuses if active VMs exist

---

## Security Enhancements

### #42 — Password Reset Token Cleanup
- **Location:** `server.ts` session cleanup cron
- **Impact:** Without cleanup, the `PasswordReset` table grows unbounded as users request resets
- **Fix:** Added to existing 6-hour cleanup cron — purges expired tokens and used tokens older than 24 hours

### #46 — Request Timeout Middleware
- **Location:** New `apps/api/src/middleware/timeout.ts`
- **Impact:** Without a timeout, slow clients or runaway database queries can hold connections indefinitely, leading to resource exhaustion under load
- **Fix:** 30-second request timeout returning 408 status. Cleans up on response finish/close.

---

## Developer Experience Improvements

### #41 — Missing ESLint & Prettier Configuration
- **Location:** `.eslintrc.js`, `.prettierrc` (referenced in `package.json` but didn't exist)
- **Impact:** `npm run lint` failed; no code formatting standards enforced
- **Fix:** Created both config files with TypeScript-aware rules matching the existing code style

### #44 — Turbo Pipeline Missing Worker & Seed
- **Location:** `turbo.json`
- **Impact:** `npm run dev` didn't include the metrics worker; `npm run db:seed` wasn't in the pipeline
- **Fix:** Added `dev:worker` and `db:seed` pipeline entries

---

## Files Changed

### New Files (8)
| File | Purpose |
|------|---------|
| `apps/api/src/lib/bigintPatch.ts` | BigInt JSON serialization fix |
| `apps/api/src/middleware/timeout.ts` | 30s request timeout |
| `apps/api/src/db/seed.ts` | Database seed script with demo data |
| `apps/web/next.config.js` | Next.js config (standalone, transpile, rewrites) |
| `.eslintrc.js` | ESLint configuration |
| `.prettierrc` | Prettier configuration |

### Modified Files (14)
| File | Changes |
|------|---------|
| `apps/api/src/server.ts` | BigInt import, timeout middleware, password reset cleanup |
| `apps/api/src/routes/auth.ts` | forgot-password + reset-password endpoints |
| `apps/api/src/routes/vms.ts` | Cursor-based pagination + status filter |
| `apps/api/src/routes/storage.ts` | Cursor-based pagination |
| `apps/api/src/routes/sql.ts` | Cursor-based pagination |
| `apps/api/src/routes/iam.ts` | Cursor-based pagination |
| `apps/api/src/routes/projects.ts` | POST (create) + DELETE endpoints |
| `apps/api/prisma/schema.prisma` | PasswordReset model + User relation |
| `apps/api/prisma/migration.sql` | PasswordReset table DDL |
| `apps/web/src/lib/apiClient.ts` | forgotPassword, resetPassword, Projects.create/delete |
| `infra/docker/docker-compose.yml` | Web service target: dev |
| `turbo.json` | dev:worker + db:seed pipeline |
| `setup.sh` | Seed instruction in output |
| `package.json` | Version bump to 3.0.0 |

---

## Test Scenarios

After deploying v3, verify these critical paths:

1. **BigInt fix:** `POST` a storage object, then `GET` the bucket list — response must include `totalSizeBytes` as a number, not crash with 500
2. **Password reset:** Call `POST /auth/forgot-password`, capture token from server logs, call `POST /auth/reset-password` with token + new password
3. **Pagination:** Create 55+ VMs via seed, call `GET /vms/:projectId?limit=50` — must return `meta.hasNextPage: true` with a `nextCursor`
4. **Docker dev:** `docker compose up` must start web service with hot-reload (dev target), not crash on standalone output
5. **Project lifecycle:** Create project, add VM, try delete (should fail), terminate VM, delete project (should succeed)
6. **Seed:** `npm run db:seed` should be idempotent (safe to run multiple times)

---

## Architecture Diagram (updated)

```
┌─────────────┐     ┌──────────────────────────┐     ┌────────────────┐
│  Next.js    │────▶│  Express API (v3.0.0)    │────▶│  PostgreSQL 16 │
│  Frontend   │     │  ├─ BigInt patch          │     │  ├─ 15 models  │
│  :3000      │     │  ├─ Timeout (30s)        │     │  ├─ indexes    │
│             │     │  ├─ Rate limiting        │     │  └─ cascades   │
│  Zustand    │     │  ├─ Auth (JWT + refresh) │     └────────────────┘
│  store      │     │  ├─ Password reset       │            │
│             │     │  ├─ Session cleanup cron  │            │
└─────────────┘     │  └─ Paginated endpoints  │     ┌──────┴─────────┐
                    └──────────────────────────┘     │ Metrics Worker │
                              :4000                   │ (10s tick)     │
                                                      └────────────────┘
```

---

*Total LOC: ~4,800 across 53 files (up from 4,383 across 47 in v2)*
