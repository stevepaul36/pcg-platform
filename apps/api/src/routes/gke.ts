// apps/api/src/routes/gke.ts
import { Router } from "express";
import { CreateGKEClusterSchema } from "@pcg/shared";
import { prisma } from "../lib/prisma";
import { requireAuth, requireProjectAccess, requireProjectWrite, AuthenticatedRequest } from "../middleware/auth";
import { AppError } from "../middleware/errorHandler";
import { logActivity } from "../services/activityLog";
import { SimulationService, BillingService } from "../services/simulation";
import { BillingEngine } from "../services/billingEngine";

export const gkeRouter = Router();
gkeRouter.use(requireAuth);

gkeRouter.get("/:projectId", requireProjectAccess, async (req, res, next) => {
  try {
    const clusters = await prisma.gKECluster.findMany({
      where: { projectId: req.params.projectId }, orderBy: { createdAt: "desc" },
    });
    res.json({ success: true, data: clusters });
  } catch (err) { next(err); }
});

gkeRouter.post("/:projectId", requireProjectAccess, requireProjectWrite, async (req, res, next) => {
  try {
    const body = CreateGKEClusterSchema.parse(req.body);
    const { user } = req as unknown as AuthenticatedRequest;
    const existing = await prisma.gKECluster.findFirst({ where: { projectId: req.params.projectId, name: body.name } });
    if (existing) throw new AppError(409, "CONFLICT", `Cluster "${body.name}" already exists`);

    const hourlyCost = BillingService.gkeClusterCost(body.machineType, body.nodeCount);
    const endpoint   = SimulationService.generateExternalIP();
    const cluster    = await prisma.gKECluster.create({
      data: { ...body, projectId: req.params.projectId, status: "PROVISIONING", endpoint, hourlyCost },
    });

    // Start billing immediately on provisioning start
    BillingEngine.trackUsage(req.params.projectId, "GKE_CLUSTER", cluster.id, cluster.name, hourlyCost).catch(() => {});

    setTimeout(async () => {
      await prisma.gKECluster.update({ where: { id: cluster.id }, data: { status: "RUNNING" } });
    }, 5000);

    await logActivity(prisma, req.params.projectId, user.email, {
      type: "GKE_CLUSTER_CREATE", description: `Created GKE cluster ${body.name}`,
      resourceId: cluster.id, severity: "INFO",
      metadata: { nodeCount: body.nodeCount, machineType: body.machineType, hourlyCost },
    });
    res.status(201).json({ success: true, data: cluster });
  } catch (err) { next(err); }
});

gkeRouter.patch("/:projectId/:clusterId/resize", requireProjectAccess, requireProjectWrite, async (req, res, next) => {
  try {
    const { user } = req as unknown as AuthenticatedRequest;
    const nodeCount = parseInt(req.body.nodeCount);
    if (!nodeCount || nodeCount < 1 || nodeCount > 100) {
      throw new AppError(400, "VALIDATION_ERROR", "nodeCount must be 1–100");
    }
    const cluster = await prisma.gKECluster.findFirst({ where: { id: req.params.clusterId, projectId: req.params.projectId } });
    if (!cluster) throw new AppError(404, "NOT_FOUND", "Cluster not found");
    if (cluster.status !== "RUNNING") throw new AppError(409, "INVALID_STATE", "Can only resize a RUNNING cluster");

    const hourlyCost = BillingService.gkeClusterCost(cluster.machineType, nodeCount);
    const updated    = await prisma.gKECluster.update({
      where: { id: cluster.id }, data: { nodeCount, hourlyCost },
    });

    await logActivity(prisma, req.params.projectId, user.email, {
      type: "GKE_CLUSTER_RESIZE", description: `Resized cluster ${cluster.name} to ${nodeCount} nodes`,
      resourceId: cluster.id, metadata: { previousNodeCount: cluster.nodeCount, newNodeCount: nodeCount },
    });
    res.json({ success: true, data: updated });
  } catch (err) { next(err); }
});

gkeRouter.delete("/:projectId/:clusterId", requireProjectAccess, requireProjectWrite, async (req, res, next) => {
  try {
    const { user } = req as unknown as AuthenticatedRequest;
    const cluster = await prisma.gKECluster.findFirst({ where: { id: req.params.clusterId, projectId: req.params.projectId } });
    if (!cluster) throw new AppError(404, "NOT_FOUND", "Cluster not found");
    await prisma.gKECluster.update({ where: { id: cluster.id }, data: { status: "STOPPING" } });
    setTimeout(async () => {
      await prisma.gKECluster.delete({ where: { id: cluster.id } });
      BillingEngine.stopUsage(cluster.id).catch(() => {});
    }, 3000);
    await logActivity(prisma, req.params.projectId, user.email, {
      type: "GKE_CLUSTER_DELETE", description: `Deleted GKE cluster ${cluster.name}`,
      resourceId: cluster.id, severity: "WARNING",
    });
    res.json({ success: true });
  } catch (err) { next(err); }
});

