// apps/api/src/routes/sql.ts

import { Router }      from "express";
import { CreateSQLSchema } from "@pcg/shared";
import { prisma }      from "../lib/prisma";
import { requireAuth, requireProjectAccess, requireProjectWrite, AuthenticatedRequest } from "../middleware/auth";
import { AppError }    from "../middleware/errorHandler";
import { logActivity } from "../services/activityLog";
import { getEffectivePlan, getPlanQuota } from "../services/subscription";

export const sqlRouter = Router();
sqlRouter.use(requireAuth);

// ── GET /api/v1/sql/:projectId ────────────────────────────────────────────────

sqlRouter.get("/:projectId", requireProjectAccess, async (req, res, next) => {
  try {
    const limit  = Math.min(Math.max(parseInt(req.query.limit as string) || 50, 1), 200);
    const cursor = req.query.cursor as string | undefined;

    const instances = await prisma.sQLInstance.findMany({
      where:   { projectId: req.params.projectId },
      orderBy: { createdAt: "desc" },
      take:   limit + 1,
      ...(cursor && { cursor: { id: cursor }, skip: 1 }),
    });

    const hasNextPage = instances.length > limit;
    const page        = hasNextPage ? instances.slice(0, -1) : instances;
    const nextCursor  = hasNextPage ? page[page.length - 1]?.id : null;

    res.json({ success: true, data: page, meta: { hasNextPage, nextCursor } });
  } catch (err) { next(err); }
});

// ── POST /api/v1/sql/:projectId ───────────────────────────────────────────────

sqlRouter.post("/:projectId", requireProjectAccess, requireProjectWrite, async (req, res, next) => {
  try {
    const body     = CreateSQLSchema.parse(req.body);
    const { user } = req as unknown as AuthenticatedRequest;
    const projectId = req.params.projectId;

    // Quota enforcement — maxSQLInstances per plan
    const owner = await prisma.user.findFirst({
      where:  { projects: { some: { id: projectId } } },
      select: { plan: true, subscriptionEnd: true },
    });
    const effectivePlan = getEffectivePlan((owner?.plan ?? "free") as any, owner?.subscriptionEnd ?? null);
    const quota         = getPlanQuota(effectivePlan);

    const instanceCount = await prisma.sQLInstance.count({ where: { projectId } });
    if (instanceCount >= quota.maxSQLInstances) {
      throw new AppError(
        429,
        "QUOTA_EXCEEDED",
        `SQL instance quota exceeded (max ${quota.maxSQLInstances} for "${effectivePlan}" plan). Delete existing instances or upgrade your plan.`,
      );
    }

    // Cloud SQL hourly pricing (us-central1, per vCPU + per GB RAM)
    // Source: cloud.google.com/sql/pricing (GCP Cheat Sheet: Database — Cloud SQL)
    const SQL_COSTS: Record<string, number> = {
      "db-f1-micro":           0.0105,
      "db-g1-small":           0.0255,
      "db-n1-standard-1":      0.0965,
      "db-n1-standard-2":      0.1930,
      "db-n1-standard-4":      0.3860,
      "db-n1-standard-8":      0.7720,
      "db-n1-highmem-2":       0.2480,
      "db-n1-highmem-4":       0.4960,
      "db-n1-highmem-8":       0.9920,
      "db-perf-optimized-N-2": 0.3082,
      "db-perf-optimized-N-4": 0.6164,
      "db-perf-optimized-N-8": 1.2328,
    };

    const instance = await prisma.sQLInstance.create({
      data: {
        projectId:        req.params.projectId,
        ...body,
        status:           "PENDING_CREATE",
        privateIp:        `10.${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 253) + 2}`,
        connectionName:   `${req.params.projectId}:${body.region}:${body.name}`,
        hourlyCost:       SQL_COSTS[body.tier] ?? 0.0965,
      },
    });

    await logActivity(prisma, req.params.projectId, user.email, {
      type:        "CREATE_SQL",
      description: `SQL instance "${instance.name}" (${instance.dbType}) created`,
      resourceId:  instance.id,
    });

    // Simulate creation delay
    setTimeout(async () => {
      await prisma.sQLInstance.updateMany({
        where: { id: instance.id, status: "PENDING_CREATE" },
        data:  { status: "RUNNABLE" },
      });
    }, 5_000);

    res.status(201).json({ success: true, data: instance });
  } catch (err) { next(err); }
});

// ── DELETE /api/v1/sql/:projectId/:instanceId ─────────────────────────────────

sqlRouter.delete("/:projectId/:instanceId", requireProjectAccess, requireProjectWrite, async (req, res, next) => {
  try {
    const { user } = req as unknown as AuthenticatedRequest;
    const instance = await prisma.sQLInstance.findFirst({
      where: { id: req.params.instanceId, projectId: req.params.projectId },
    });
    if (!instance) throw new AppError(404, "NOT_FOUND", "SQL instance not found");

    await prisma.sQLInstance.delete({ where: { id: req.params.instanceId } });

    await logActivity(prisma, req.params.projectId, user.email, {
      type:        "DELETE_SQL",
      description: `SQL instance "${instance.name}" deleted`,
      resourceId:  instance.id,
      severity:    "WARNING",
    });

    res.json({ success: true, data: null });
  } catch (err) { next(err); }
});
