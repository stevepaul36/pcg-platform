-- prisma/migrations/add_refresh_tokens_and_user_votes.sql
-- Run this if migrating from the original schema.
-- Or just run: npx prisma migrate dev --name "add_refresh_tokens_and_user_votes"

-- ── RefreshToken ──────────────────────────────────────────────────────────────

CREATE TABLE "RefreshToken" (
  "id"        TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId"    TEXT NOT NULL,
  "token"     TEXT NOT NULL UNIQUE,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
  "ipAddress" TEXT,
  "userAgent" TEXT,
  CONSTRAINT "RefreshToken_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE
);

CREATE INDEX "RefreshToken_token_idx"     ON "RefreshToken"("token");
CREATE INDEX "RefreshToken_userId_idx"    ON "RefreshToken"("userId");
CREATE INDEX "RefreshToken_expiresAt_idx" ON "RefreshToken"("expiresAt");

-- ── UserVote ──────────────────────────────────────────────────────────────────

CREATE TABLE "UserVote" (
  "id"            TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId"        TEXT NOT NULL,
  "improvementId" TEXT NOT NULL,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT NOW(),
  CONSTRAINT "UserVote_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE,
  CONSTRAINT "UserVote_improvementId_fkey"
    FOREIGN KEY ("improvementId") REFERENCES "Improvement"("id") ON DELETE CASCADE,
  CONSTRAINT "UserVote_userId_improvementId_unique"
    UNIQUE ("userId", "improvementId")
);

CREATE INDEX "UserVote_improvementId_idx" ON "UserVote"("improvementId");

-- ── Improvement.authorEmail ───────────────────────────────────────────────────

ALTER TABLE "Improvement" ADD COLUMN IF NOT EXISTS "authorEmail" TEXT NOT NULL DEFAULT '';

-- ── IAMMember email index ─────────────────────────────────────────────────────
-- Used by the new requireProjectAccess IAM check.

CREATE INDEX IF NOT EXISTS "IAMMember_email_idx" ON "IAMMember"("email");

-- ── Session expiresAt index ───────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS "Session_expiresAt_idx" ON "Session"("expiresAt");

-- ── PasswordReset ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "PasswordReset" (
  "id"        TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId"    TEXT NOT NULL,
  "token"     TEXT NOT NULL UNIQUE,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt"    TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
  CONSTRAINT "PasswordReset_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "PasswordReset_token_idx"     ON "PasswordReset"("token");
CREATE INDEX IF NOT EXISTS "PasswordReset_userId_idx"    ON "PasswordReset"("userId");
CREATE INDEX IF NOT EXISTS "PasswordReset_expiresAt_idx" ON "PasswordReset"("expiresAt");
