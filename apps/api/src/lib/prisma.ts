// apps/api/src/lib/prisma.ts
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  log: process.env.NODE_ENV === "development"
    ? ["query", "error", "warn"]
    : ["error", "warn"],
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
