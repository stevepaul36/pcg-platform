// apps/api/src/lib/prisma.ts
// Uses the extracted logger (not server.ts) to break the circular-dependency chain.

import { PrismaClient } from "@prisma/client";
import { logger }       from "./logger";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  log: [
    { emit: "event", level: "query" },
    { emit: "event", level: "error" },
    { emit: "event", level: "warn"  },
  ],
});

// ── Slow-query detection (dev only) ──────────────────────────────────────────

if (process.env.NODE_ENV === "development") {
  prisma.$on("query", e => {
    if (e.duration > 100) {
      logger.warn({ duration: e.duration, query: e.query }, "Slow query detected");
    }
  });
}

prisma.$on("error", e => {
  logger.error({ message: e.message, target: e.target }, "Prisma error");
});

// In development, reuse the single instance across HMR cycles
if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

// ── Health-check helper ───────────────────────────────────────────────────────

export async function checkDatabaseConnection(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}
