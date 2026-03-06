// apps/api/src/routes/gke.ts
import { Router } from "express";
import { CreateGKEClusterSchema } from "@pcg/shared";
import { prisma } from "../lib/prisma";
import { requireAuth, requireProjectAccess, requireProjectWrite, AuthenticatedRequest } from "../middleware/auth";
import { AppError } from "../middleware/errorHandler";
import { logActivity } from "../services/activityLog";
import { SimulationService } from "../services/simulation";

export const gkeRouter = Router();
gkeRouter.use(requireAuth);

const GKE_COST_PER_NODE: Record<string, number> = {
  "e2-medium": 0.033, "e2-standard-2": 0.067, "e2-standard-4": 0.134,
  "n1-standard-2": 0.095, "n1-standard-4": 0.19, "n2-standard-2": 0.097,
};

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
    const nodeHourlyCost = GKE_COST_PER_NODE[body.machineType] ?? 0.05;
    const hourlyCost = nodeHourlyCost * body.nodeCount;
    const endpoint = SimulationService.generateExternalIP();
    const cluster = await prisma.gKECluster.create({
      data: { ...body, projectId: req.params.projectId, status: "PROVISIONING", endpoint, hourlyCost },
    });
    setTimeout(async () => {
      await prisma.gKECluster.update({ where: { id: cluster.id }, data: { status: "RUNNING" } });
    }, 5000);
    await logActivity(prisma, req.params.projectId, user.email, { type: "GKE_CLUSTER_CREATE", description: `Created GKE cluster ${body.name}`, resourceId: cluster.id, severity: "INFO" });
    res.status(201).json({ success: true, data: cluster });
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
    }, 3000);
    await logActivity(prisma, req.params.projectId, user.email, { type: "GKE_CLUSTER_DELETE", description: `Deleted GKE cluster ${cluster.name}`, resourceId: cluster.id, severity: "WARNING" });
    res.json({ success: true });
  } catch (err) { next(err); }
});
