// apps/api/src/routes/dataproc.ts

import { Router } from "express";
import { CreateDataprocClusterSchema } from "@pcg/shared";
import {
  requireAuth,
  requireProjectAccess,
  requireProjectWrite,
  AuthenticatedRequest,
} from "../middleware/auth";
import { prisma }          from "../lib/prisma";
import { logger }          from "../lib/logger";
import { logActivity }     from "../services/activityLog";
import { ResourceTracker } from "../services/resourceTracker";

export const dataprocRouter = Router();

dataprocRouter.use(requireAuth);

// ── Cost table: USD per machine-hour ─────────────────────────────────────────
const MACHINE_COST_PER_HOUR: Record<string, number> = {
  "n1-standard-2": 0.095,
  "n1-standard-4": 0.190,
  "n1-standard-8": 0.380,
  "n2-standard-2": 0.097,
  "n2-standard-4": 0.194,
  "n2-standard-8": 0.388,
};

const FALLBACK_MASTER_COST = 0.190; // n1-standard-4
const FALLBACK_WORKER_COST = 0.095; // n1-standard-2

function computeHourlyCost(
  masterType:  string,
  workerType:  string,
  workerCount: number,
): number {
  const masterCost = MACHINE_COST_PER_HOUR[masterType] ?? FALLBACK_MASTER_COST;
  const workerCost = MACHINE_COST_PER_HOUR[workerType] ?? FALLBACK_WORKER_COST;
  return masterCost + workerCost * workerCount;
}

// ── Simulate GCP provisioning: CREATING → RUNNING after ~4 s ─────────────────
const PROVISIONING_DELAY_MS = 4_000;

function scheduleClusterReady(clusterId: string): void {
  setTimeout(async () => {
    try {
      await prisma.dataprocCluster.update({
        where: { id: clusterId },
        data:  { status: "RUNNING" },
      });
      logger.info({ clusterId }, "Dataproc cluster transitioned to RUNNING");
    } catch (err) {
      // Non-fatal — metrics worker will reconcile on its next tick
      logger.error({ err, clusterId }, "Failed to transition Dataproc cluster to RUNNING");
    }
  }, PROVISIONING_DELAY_MS);
}

// ── GET /:projectId — list clusters ──────────────────────────────────────────

dataprocRouter.get(
  "/:projectId",
  requireProjectAccess,
  async (req, res, next) => {
    try {
      const clusters = await prisma.dataprocCluster.findMany({
        where:   { projectId: req.params.projectId },
        orderBy: { createdAt: "desc" },
      });
      res.json({ success: true, data: clusters });
    } catch (err) {
      next(err);
    }
  },
);

// ── GET /:projectId/:id — single cluster ─────────────────────────────────────

dataprocRouter.get(
  "/:projectId/:id",
  requireProjectAccess,
  async (req, res, next) => {
    try {
      const cluster = await prisma.dataprocCluster.findFirst({
        where: { id: req.params.id, projectId: req.params.projectId },
      });

      if (!cluster) {
        res.status(404).json({
          success: false,
          error: { code: "NOT_FOUND", message: "Dataproc cluster not found" },
        });
        return;
      }

      res.json({ success: true, data: cluster });
    } catch (err) {
      next(err);
    }
  },
);

// ── POST /:projectId — create cluster ────────────────────────────────────────

dataprocRouter.post(
  "/:projectId",
  requireProjectAccess,
  requireProjectWrite,
  async (req, res, next) => {
    try {
      const { user }   = req as unknown as AuthenticatedRequest;
      const body       = CreateDataprocClusterSchema.parse(req.body);
      const hourlyCost = computeHourlyCost(body.masterType, body.workerType, body.workerCount);

      // ⚠️  Always enumerate Prisma fields explicitly — never spread `...body`.
      //
      //    Using `{ ...body, hourlyCost, projectId }` is convenient but fragile:
      //    if the Prisma model and the Zod schema diverge (e.g. a migration hasn't
      //    run yet, or Zod gained a field the model doesn't have), Prisma throws
      //    PrismaClientValidationError at runtime with zero compile-time warning.
      //
      //    Explicit mapping catches the mismatch at TypeScript compile time and
      //    produces a clear error during `tsc`, not a 500 in production.
      const cluster = await prisma.dataprocCluster.create({
        data: {
          projectId:    req.params.projectId,
          name:         body.name,
          region:       body.region,
          masterType:   body.masterType,
          workerType:   body.workerType,
          workerCount:  body.workerCount,
          imageVersion: body.imageVersion,
          autoscaling:  body.autoscaling,
          hourlyCost,
          // `status` and `createdAt` intentionally omitted — schema defaults apply
        },
      });

      // Fire-and-forget: simulate async provisioning delay
      scheduleClusterReady(cluster.id);

      await logActivity(prisma, req.params.projectId, user.email, {
        type:        "DATAPROC_CREATE",
        description: `Created Dataproc cluster "${body.name}" (${body.masterType} master, ${body.workerCount}× ${body.workerType} workers) in ${body.region}`,
        resourceId:  cluster.id,
        metadata: {
          masterType:   body.masterType,
          workerType:   body.workerType,
          workerCount:  body.workerCount,
          imageVersion: body.imageVersion,
          autoscaling:  body.autoscaling,
          hourlyCost,
        },
      });

      ResourceTracker.onCreate(
        req.params.projectId,
        "DATAPROC",
        cluster.id,
        body.name,
        hourlyCost,
      ).catch((err: unknown) =>
        logger.warn({ err, clusterId: cluster.id }, "ResourceTracker.onCreate failed"),
      );

      res.status(201).json({ success: true, data: cluster });
    } catch (err) {
      next(err);
    }
  },
);

// ── DELETE /:projectId/:id — delete cluster ───────────────────────────────────

dataprocRouter.delete(
  "/:projectId/:id",
  requireProjectAccess,
  requireProjectWrite,
  async (req, res, next) => {
    try {
      const { user } = req as unknown as AuthenticatedRequest;

      // Verify ownership before deleting — prevents cross-project deletion
      const cluster = await prisma.dataprocCluster.findFirst({
        where: { id: req.params.id, projectId: req.params.projectId },
      });

      if (!cluster) {
        res.status(404).json({
          success: false,
          error: { code: "NOT_FOUND", message: "Dataproc cluster not found" },
        });
        return;
      }

      await prisma.dataprocCluster.delete({
        where: { id: req.params.id },
      });

      await logActivity(prisma, req.params.projectId, user.email, {
        type:        "DATAPROC_DELETE",
        description: `Deleted Dataproc cluster "${cluster.name}"`,
        resourceId:  req.params.id,
        severity:    "WARNING",
        metadata:    { clusterName: cluster.name, region: cluster.region },
      });

      ResourceTracker.onDelete(
        req.params.projectId,
        "DATAPROC",
        req.params.id,
        cluster.name,
      ).catch((err: unknown) =>
        logger.warn({ err, clusterId: req.params.id }, "ResourceTracker.onDelete failed"),
      );

      res.json({ success: true, data: null });
    } catch (err) {
      next(err);
    }
  },
);
