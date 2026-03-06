import { Router } from "express";
import { CreateDataprocClusterSchema } from "@pcg/shared";
import { requireAuth, requireProjectAccess, requireProjectWrite, AuthenticatedRequest } from "../middleware/auth";
import { prisma } from "../lib/prisma";
import { logActivity } from "../services/activityLog";
import { ResourceTracker } from "../services/resourceTracker";
export const dataprocRouter = Router();
dataprocRouter.use(requireAuth);
dataprocRouter.get("/:projectId", requireProjectAccess, async (req, res, next) => {
  try { res.json({ success: true, data: await prisma.dataprocCluster.findMany({ where: { projectId: req.params.projectId }, orderBy: { createdAt: "desc" } }) }); } catch(e) { next(e); }
});

dataprocRouter.post("/:projectId", requireProjectAccess, requireProjectWrite, async (req, res, next) => {
  try { const { user } = req as unknown as AuthenticatedRequest; const body = CreateDataprocClusterSchema.parse(req.body);
    const costMap: Record<string,number> = {"n1-standard-2":0.095,"n1-standard-4":0.19,"n1-standard-8":0.38};
    const hourlyCost = (costMap[body.masterType] ?? 0.19) + (costMap[body.workerType] ?? 0.095) * body.workerCount;
    const r = await prisma.dataprocCluster.create({ data: { ...body, hourlyCost, projectId: req.params.projectId } });
    setTimeout(async () => { try { await prisma.dataprocCluster.update({ where: { id: r.id }, data: { status: "RUNNING" } }); } catch {} }, 4000);
    await logActivity(prisma, req.params.projectId, user.email, { type: "DATAPROC_CREATE", description: `Created cluster "${body.name}"` });
    ResourceTracker.onCreate(req.params.projectId, "DATAPROC", r.id, body.name ?? r.id).catch(() => {});
    res.status(201).json({ success: true, data: r }); } catch(e) { next(e); }
});
dataprocRouter.delete("/:projectId/:id", requireProjectAccess, requireProjectWrite, async (req, res, next) => {
  try { const { user } = req as unknown as AuthenticatedRequest;
    await prisma.dataprocCluster.delete({ where: { id: req.params.id } });
    await logActivity(prisma, req.params.projectId, user.email, { type: "DATAPROC_DELETE", description: `Deleted Dataproc Cluster ${req.params.id}`, severity: "WARNING" });
    ResourceTracker.onDelete(req.params.projectId, "DATAPROC", req.params.id ?? req.params.datasetId ?? "", "").catch(() => {});
    res.json({ success: true, data: null }); } catch(e) { next(e); }
});
