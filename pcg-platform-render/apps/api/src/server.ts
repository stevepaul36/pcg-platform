// apps/api/src/server.ts

import "./lib/bigintPatch";    // Must be first — fixes BigInt JSON serialization
import express     from "express";
import cors        from "cors";
import helmet      from "helmet";
import compression from "compression";
import { pinoHttp } from "pino-http";

import { authRouter }          from "./routes/auth";
import { projectsRouter }      from "./routes/projects";
import { vmRouter }            from "./routes/vms";
import { storageRouter }       from "./routes/storage";
import { sqlRouter }           from "./routes/sql";
import { iamRouter }           from "./routes/iam";
import { logsRouter }          from "./routes/logs";
import { metricsRouter }       from "./routes/metrics";
import { announcementsRouter } from "./routes/announcements";
import { improvementsRouter }  from "./routes/improvements";
import { errorHandler }        from "./middleware/errorHandler";
import { requestId }           from "./middleware/requestId";
import { requestTimeout }      from "./middleware/timeout";
import { globalLimiter }       from "./middleware/rateLimiter";
import { env }                 from "./lib/env";
import { logger }              from "./lib/logger";
import { prisma, checkDatabaseConnection } from "./lib/prisma";
import { startInlineMetricsWorker }        from "./workers/metricsWorker";

// ── Express app ───────────────────────────────────────────────────────────────

const app = express();

// Trust n hops of reverse proxies so req.ip reflects the real client IP
app.set("trust proxy", env.TRUST_PROXY);

app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(cors({
  origin:      env.CORS_ORIGINS.split(",").map(o => o.trim()),
  credentials: true,
}));
app.use(compression());
app.use(express.json({ limit: "2mb" }));
app.use(requestId);
app.use(requestTimeout(30_000)); // 30-second timeout on all requests
app.use(pinoHttp({ logger, autoLogging: { ignore: (req) => (req as any).url === "/health" } }));

app.use(globalLimiter);

// ── Health check ──────────────────────────────────────────────────────────────

app.get("/health", async (_req, res) => {
  const dbOk = await checkDatabaseConnection();
  const status = dbOk ? "ok" : "degraded";
  res.status(dbOk ? 200 : 503).json({
    status,
    ts:      new Date().toISOString(),
    version: process.env.npm_package_version ?? "unknown",
    uptime:  process.uptime(),
    checks:  { database: dbOk ? "ok" : "error" },
  });
});

// ── Routes ────────────────────────────────────────────────────────────────────

app.use("/api/v1/auth",          authRouter);
app.use("/api/v1/projects",      projectsRouter);
app.use("/api/v1/vms",           vmRouter);
app.use("/api/v1/storage",       storageRouter);
app.use("/api/v1/sql",           sqlRouter);
app.use("/api/v1/iam",           iamRouter);
app.use("/api/v1/logs",          logsRouter);
app.use("/api/v1/metrics",       metricsRouter);
app.use("/api/v1/announcements", announcementsRouter);
app.use("/api/v1/improvements",  improvementsRouter);

// 404 fallthrough
app.use((req, res) =>
  res.status(404).json({
    success: false,
    error: { code: "NOT_FOUND", message: `Route ${req.method} ${req.path} not found` },
  }),
);

app.use(errorHandler);

// ── Session cleanup cron ──────────────────────────────────────────────────────
// Purges expired sessions and revoked refresh tokens every 6 hours to prevent
// unbounded table growth. In production, prefer a dedicated cron job or
// pg_cron extension, but this is a pragmatic in-process default.

const CLEANUP_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 hours

async function cleanupExpiredSessions(): Promise<void> {
  try {
    const now = new Date();
    const [sessions, tokens, resetTokens] = await prisma.$transaction([
      prisma.session.deleteMany({ where: { expiresAt: { lt: now } } }),
      prisma.refreshToken.deleteMany({
        where: {
          OR: [
            { expiresAt: { lt: now } },
            { revokedAt: { not: null, lt: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) } },
          ],
        },
      }),
      // Clean up expired/used password reset tokens older than 24 hours
      prisma.passwordReset.deleteMany({
        where: {
          OR: [
            { expiresAt: { lt: now } },
            { usedAt: { not: null, lt: new Date(now.getTime() - 24 * 60 * 60 * 1000) } },
          ],
        },
      }),
    ]);
    if (sessions.count > 0 || tokens.count > 0 || resetTokens.count > 0) {
      logger.info(
        { expiredSessions: sessions.count, expiredTokens: tokens.count, expiredResetTokens: resetTokens.count },
        "Session cleanup completed",
      );
    }
  } catch (err) {
    logger.error({ err }, "Session cleanup failed");
  }
}

// ── Start & graceful shutdown ─────────────────────────────────────────────────

const server = app.listen(env.PORT, () => {
  logger.info({ port: env.PORT, env: env.NODE_ENV }, "PCG API server started");
});

// Run cleanup on startup, then periodically
cleanupExpiredSessions();
const cleanupTimer = setInterval(cleanupExpiredSessions, CLEANUP_INTERVAL_MS);

// ── Inline metrics worker (Render free tier) ──────────────────────────────────
// On Render, background workers require a paid plan. When METRICS_WORKER_INLINE
// is true, we run the metrics tick inside this process instead.
let stopMetricsWorker: (() => void) | null = null;
if (env.METRICS_WORKER_INLINE) {
  stopMetricsWorker = startInlineMetricsWorker();
  logger.info("Inline metrics worker started");
}

async function shutdown(signal: string): Promise<void> {
  logger.info({ signal }, "Shutdown signal received — draining connections");

  clearInterval(cleanupTimer);
  if (stopMetricsWorker) stopMetricsWorker();

  server.close(async () => {
    logger.info("HTTP server closed");
    await prisma.$disconnect();
    logger.info("Database disconnected — exiting");
    process.exit(0);
  });

  // Force-exit if graceful shutdown takes too long
  setTimeout(() => {
    logger.error("Graceful shutdown timed out — forcing exit");
    process.exit(1);
  }, 15_000);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT",  () => shutdown("SIGINT"));

// Prevent unhandled errors from crashing the process silently
process.on("unhandledRejection", (reason: unknown) => {
  logger.error({ err: reason }, "Unhandled promise rejection");
});

process.on("uncaughtException", (err: Error) => {
  logger.fatal({ err }, "Uncaught exception — shutting down");
  shutdown("uncaughtException");
});

export default app;
