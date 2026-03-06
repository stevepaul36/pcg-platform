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
import { bqRouter }            from "./routes/bigquery";
import { pubsubRouter }        from "./routes/pubsub";
import { functionsRouter }     from "./routes/functions";
import { gkeRouter }           from "./routes/gke";
import { cloudrunRouter }      from "./routes/cloudrun";
import { networkingRouter }    from "./routes/networking";
import { securityRouter }      from "./routes/security";
import { vertexRouter }        from "./routes/vertexai";
import { dataflowRouter }      from "./routes/dataflow";
import { monitoringRouter }    from "./routes/monitoring";
import { cloudbuildRouter }    from "./routes/cloudbuild";
import { artifactsRouter }     from "./routes/artifacts";
import { schedulerRouter }     from "./routes/scheduler";
import { apigatewayRouter }    from "./routes/apigateway";
import { memorystoreRouter }   from "./routes/memorystore";
import { cloudarmorRouter }    from "./routes/cloudarmor";
import { firestoreRouter }    from "./routes/firestore";
import { loggingRouter }      from "./routes/logging";
import { tasksRouter }        from "./routes/tasks";
import { dataprocRouter }     from "./routes/dataproc";
import { cdnRouter }          from "./routes/cdn";
import { firewallRouter }     from "./routes/firewall";
import { serviceaccountsRouter } from "./routes/serviceaccounts";
import { budgetsRouter }      from "./routes/budgets";
import { workflowsRouter }    from "./routes/workflows";
import { deployRouter }       from "./routes/deploy";
import { billingRouter }      from "./routes/billing";
import { quotasRouter }       from "./routes/quotas";
import { lifecycleRouter }    from "./routes/lifecycle";
import { organizationsRouter } from "./routes/organizations";
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
// Normalize allowed origins: trim whitespace and trailing slashes
const allowedOrigins = env.CORS_ORIGINS
  .split(",")
  .map(o => o.trim().replace(/\/+$/, ""))
  .filter(Boolean);

logger.info({ allowedOrigins }, "CORS configured");

app.use(cors({
  origin: (origin, callback) => {
    // Allow server-to-server calls (no origin header) and health checks
    if (!origin) return callback(null, true);
    const normalized = origin.replace(/\/+$/, "");
    if (allowedOrigins.includes(normalized)) {
      callback(null, true);
    } else {
      logger.warn({ origin, allowedOrigins }, "CORS rejected request");
      callback(new Error(`CORS: origin '${origin}' not in CORS_ORIGINS. Update env var on pcg-api.`));
    }
  },
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
    ts:           new Date().toISOString(),
    version:      process.env.npm_package_version ?? "unknown",
    uptime:       Math.round(process.uptime()),
    environment:  env.NODE_ENV,
    checks:       { database: dbOk ? "ok" : "error" },
    // Expose allowed origins so admins can diagnose CORS issues
    cors_origins: allowedOrigins,
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
app.use("/api/v1/bigquery",      bqRouter);
app.use("/api/v1/pubsub",        pubsubRouter);
app.use("/api/v1/functions",     functionsRouter);
app.use("/api/v1/gke",           gkeRouter);
app.use("/api/v1/cloudrun",      cloudrunRouter);
app.use("/api/v1/networking",    networkingRouter);
app.use("/api/v1/security",      securityRouter);
app.use("/api/v1/vertexai",      vertexRouter);
app.use("/api/v1/dataflow",      dataflowRouter);
app.use("/api/v1/monitoring",    monitoringRouter);
app.use("/api/v1/cloudbuild",    cloudbuildRouter);
app.use("/api/v1/artifacts",     artifactsRouter);
app.use("/api/v1/scheduler",     schedulerRouter);
app.use("/api/v1/apigateway",    apigatewayRouter);
app.use("/api/v1/memorystore",   memorystoreRouter);
app.use("/api/v1/cloudarmor",    cloudarmorRouter);
app.use("/api/v1/firestore",     firestoreRouter);
app.use("/api/v1/logging",       loggingRouter);
app.use("/api/v1/tasks",         tasksRouter);
app.use("/api/v1/dataproc",      dataprocRouter);
app.use("/api/v1/cdn",           cdnRouter);
app.use("/api/v1/firewall",      firewallRouter);
app.use("/api/v1/serviceaccounts", serviceaccountsRouter);
app.use("/api/v1/budgets",       budgetsRouter);
app.use("/api/v1/workflows",     workflowsRouter);
app.use("/api/v1/deploy",        deployRouter);
app.use("/api/v1/billing",       billingRouter);
app.use("/api/v1/quotas",        quotasRouter);
app.use("/api/v1/lifecycle",     lifecycleRouter);
app.use("/api/v1/organizations", organizationsRouter);

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
