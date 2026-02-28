// apps/api/src/lib/env.ts
// All environment variables are validated at startup.
// The process exits loudly if anything is misconfigured.

import { z } from "zod";

const envSchema = z.object({
  NODE_ENV:          z.enum(["development", "staging", "production"]).default("development"),
  PORT:              z.coerce.number().default(4000),

  // ── Database ───────────────────────────────────────────────────────────────
  DATABASE_URL:      z.string().url("DATABASE_URL must be a valid postgres URL"),
  // Render provides a connection pooler URL as DATABASE_URL. Prisma needs a
  // direct (non-pooled) connection for migrations. Set both to the same value
  // in render.yaml; they are automatically identical on Render's free tier.
  DIRECT_URL:        z.string().url().optional(),

  // ── Auth ───────────────────────────────────────────────────────────────────
  JWT_SECRET:              z.string().min(32, "JWT_SECRET must be at least 32 characters"),
  JWT_EXPIRES_IN:          z.string().regex(/^\d+[smhd]$/, "JWT_EXPIRES_IN must match format like 15m, 1h, 7d").default("15m"),
  JWT_REFRESH_SECRET:      z.string().min(32, "JWT_REFRESH_SECRET must be at least 32 characters"),
  JWT_REFRESH_EXPIRES_IN:  z.string().regex(/^\d+[smhd]$/, "JWT_REFRESH_EXPIRES_IN must match format like 30d, 24h").default("30d"),

  // ── CORS ───────────────────────────────────────────────────────────────────
  CORS_ORIGINS:      z.string().default("http://localhost:3000"),

  // ── AI ─────────────────────────────────────────────────────────────────────
  ANTHROPIC_API_KEY: z.string().optional(),

  // ── Logging ────────────────────────────────────────────────────────────────
  LOG_LEVEL:         z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),

  // ── Infra ──────────────────────────────────────────────────────────────────
  REDIS_URL:         z.string().url().optional(),
  TRUST_PROXY:       z.coerce.number().int().min(0).default(1),

  // ── Administration ─────────────────────────────────────────────────────────
  // Comma-separated list of email addresses that have admin privileges.
  // In production, prefer a proper roles table; this is a pragmatic bootstrap.
  ADMIN_EMAILS:      z.string().default(""),

  // ── Workers ────────────────────────────────────────────────────────────────
  // Set to "true" on Render (free tier has no cron jobs / background workers).
  // The metrics worker will run in-process on a setInterval inside server.ts.
  METRICS_WORKER_INLINE: z.string().optional().transform(v => v === "true"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("❌ Invalid environment variables:");
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
export type Env  = typeof env;

// Derived helpers ─────────────────────────────────────────────────────────────

export const ADMIN_EMAIL_SET = new Set(
  env.ADMIN_EMAILS.split(",").map(e => e.trim().toLowerCase()).filter(Boolean),
);

export function isAdminEmail(email: string): boolean {
  return ADMIN_EMAIL_SET.has(email.toLowerCase());
}
