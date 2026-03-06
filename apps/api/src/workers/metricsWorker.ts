// apps/api/src/workers/metricsWorker.ts
// Two modes:
//   1. Standalone process: `ts-node src/workers/metricsWorker.ts`
//      Used in Docker Compose / Cloud Run sidecar setups.
//   2. Inline (Render free tier): imported by server.ts, runs via setInterval
//      in the same process. Enabled by setting METRICS_WORKER_INLINE=true.

import { prisma }            from "../lib/prisma";
import { SimulationService } from "../services/simulation";
import { logger }            from "../lib/logger";

const TICK_INTERVAL_MS = 10_000;
const BILLING_FRACTION = TICK_INTERVAL_MS / (1_000 * 3_600);  // fraction of 1 hour
const HISTORY_WINDOW   = 30;                                   // sparkline points

let lastTickAt:   Date | null = null;
let isRunning                 = false;

// ── Tick ──────────────────────────────────────────────────────────────────────

export async function tick(): Promise<void> {
  if (isRunning) {
    logger.warn("Previous metrics tick still running — skipping");
    return;
  }
  isRunning  = true;
  lastTickAt = new Date();

  try {
    const runningVMs = await prisma.vMInstance.findMany({
      where:  { status: "RUNNING" },
      select: {
        id: true, projectId: true,
        cpuUsage: true, ramUsage: true, netIn: true, netOut: true,
        uptimeSec: true, cpuHistory: true, ramHistory: true,
        hourlyCost: true, diskHourlyCost: true,
      },
    });

    if (runningVMs.length === 0) return;

    const updates: Array<{
      id:         string;
      cpuUsage:   number;
      ramUsage:   number;
      netIn:      number;
      netOut:     number;
      uptimeSec:  number;
      cpuHistory: number[];
      ramHistory: number[];
    }> = [];

    const projectSpend: Record<string, number> = {};

    for (const vm of runningVMs) {
      const newCpu    = SimulationService.jitterMetrics(vm.cpuUsage, 15, 2,  98);
      const newRam    = SimulationService.jitterMetrics(vm.ramUsage,  8, 10, 95);
      const newNetIn  = Math.max(0, vm.netIn  + (Math.random() - 0.5) * 20);
      const newNetOut = Math.max(0, vm.netOut + (Math.random() - 0.5) * 10);

      const cpuHistory = [...vm.cpuHistory.slice(-(HISTORY_WINDOW - 1)), newCpu];
      const ramHistory = [...vm.ramHistory.slice(-(HISTORY_WINDOW - 1)), newRam];

      const tickCost = (vm.hourlyCost + vm.diskHourlyCost) * BILLING_FRACTION;
      projectSpend[vm.projectId] = (projectSpend[vm.projectId] ?? 0) + tickCost;

      updates.push({
        id: vm.id,
        cpuUsage:  newCpu,
        ramUsage:  newRam,
        netIn:     newNetIn,
        netOut:    newNetOut,
        uptimeSec: vm.uptimeSec + Math.round(TICK_INTERVAL_MS / 1_000),
        cpuHistory,
        ramHistory,
      });
    }

    // Batch all writes into one transaction (avoids N+1 round-trips)
    await prisma.$transaction([
      ...updates.map(u =>
        prisma.vMInstance.update({
          where: { id: u.id },
          data: {
            cpuUsage:   u.cpuUsage,
            ramUsage:   u.ramUsage,
            netIn:      u.netIn,
            netOut:     u.netOut,
            uptimeSec:  u.uptimeSec,
            cpuHistory: u.cpuHistory,
            ramHistory: u.ramHistory,
          },
        }),
      ),
      ...Object.entries(projectSpend).map(([projectId, delta]) =>
        prisma.project.update({
          where: { id: projectId },
          data:  { totalSpendUSD: { increment: parseFloat(delta.toFixed(8)) } },
        }),
      ),
    ]);

    logger.debug(
      { vmCount: runningVMs.length, projectCount: Object.keys(projectSpend).length },
      "Metrics tick completed",
    );
  } catch (err) {
    logger.error({ err }, "Metrics worker tick failed");
    // Non-fatal — worker continues on next interval
  } finally {
    isRunning = false;
  }
}

// ── Inline mode (Render free tier) ────────────────────────────────────────────
// Returns a stop() function so server.ts can cancel the interval on shutdown.

export function startInlineMetricsWorker(): () => void {
  void tick(); // fire immediately without blocking startup
  const timer = setInterval(() => void tick(), TICK_INTERVAL_MS);
  return () => clearInterval(timer);
}

// ── Standalone process mode ───────────────────────────────────────────────────
// Only runs when this file is executed directly, not when imported by server.ts.

if (require.main === module) {
  (async () => {
    logger.info("PCG Metrics worker starting (standalone)");

    await tick(); // run immediately on start
    const timer = setInterval(() => void tick(), TICK_INTERVAL_MS);

    // Health probe: `kill -USR1 <pid>` to check last tick time
    process.on("SIGUSR1", () => {
      logger.info({ lastTickAt, isRunning }, "Worker heartbeat probe");
    });

    const shutdown = async (signal: string) => {
      logger.info({ signal }, "Worker shutting down cleanly");
      clearInterval(timer);
      await prisma.$disconnect();
      process.exit(0);
    };

    process.on("SIGTERM", () => void shutdown("SIGTERM"));
    process.on("SIGINT",  () => void shutdown("SIGINT"));
  })().catch(err => {
    logger.fatal({ err }, "Worker failed to start");
    process.exit(1);
  });
}
