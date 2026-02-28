// apps/api/src/routes/metrics.ts

import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth, requireProjectAccess } from "../middleware/auth";

export const metricsRouter = Router();
metricsRouter.use(requireAuth);

// ── GET /api/v1/metrics/:projectId ────────────────────────────────────────────
// Returns aggregate resource metrics for a project dashboard.

metricsRouter.get("/:projectId", requireProjectAccess, async (req, res, next) => {
  try {
    const projectId = req.params.projectId;

    const [project, vms, buckets, sqlInstances] = await prisma.$transaction([
      prisma.project.findUnique({ where: { id: projectId }, select: { totalSpendUSD: true } }),
      prisma.vMInstance.findMany({
        where:  { projectId },
        select: { status: true, hourlyCost: true, diskHourlyCost: true, cpuUsage: true, ramUsage: true },
      }),
      prisma.storageBucket.findMany({
        where:  { projectId },
        select: { totalSizeBytes: true },
      }),
      prisma.sQLInstance.findMany({
        where:  { projectId },
        select: { status: true, hourlyCost: true },
      }),
    ]);

    const runningVMs = vms.filter(v => v.status === "RUNNING");

    res.json({
      success: true,
      data: {
        totalSpendUSD: project?.totalSpendUSD ?? 0,
        compute: {
          totalVMs:     vms.length,
          runningVMs:   runningVMs.length,
          avgCpuUsage:  runningVMs.length ? runningVMs.reduce((a, v) => a + v.cpuUsage, 0) / runningVMs.length : 0,
          avgRamUsage:  runningVMs.length ? runningVMs.reduce((a, v) => a + v.ramUsage, 0) / runningVMs.length : 0,
          hourlyRate:   runningVMs.reduce((a, v) => a + v.hourlyCost + v.diskHourlyCost, 0),
        },
        storage: {
          totalBuckets:   buckets.length,
          totalSizeBytes: buckets.reduce((a, b) => a + Number(b.totalSizeBytes), 0),
        },
        sql: {
          totalInstances:  sqlInstances.length,
          runningInstances: sqlInstances.filter(s => s.status === "RUNNABLE").length,
        },
      },
    });
  } catch (err) { next(err); }
});
