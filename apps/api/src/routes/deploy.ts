import { Router } from "express";
import { CreateDeliveryPipelineSchema } from "@pcg/shared";
import { Prisma } from "@prisma/client";
import { requireAuth, requireProjectAccess, requireProjectWrite, AuthenticatedRequest } from "../middleware/auth";
import { prisma } from "../lib/prisma";
import { logActivity } from "../services/activityLog";
import { ResourceTracker } from "../services/resourceTracker";
export const deployRouter = Router();
deployRouter.use(requireAuth);
deployRouter.get("/:projectId", requireProjectAccess, async (req, res, next) => {
  try { res.json({ success: true, data: await prisma.deliveryPipeline.findMany({ where: { projectId: req.params.projectId }, orderBy: { createdAt: "desc" } }) }); } catch(e) { next(e); }
});

deployRouter.post("/:projectId", requireProjectAccess, requireProjectWrite, async (req, res, next) => {
  try { const { user } = req as unknown as AuthenticatedRequest; const body = CreateDeliveryPipelineSchema.parse(req.body);
    const { stages, ...rest } = body;
    const r = await prisma.deliveryPipeline.create({ data: { ...rest, stages: stages as unknown as Prisma.InputJsonValue, projectId: req.params.projectId } });
    await logActivity(prisma, req.params.projectId, user.email, { type: "PIPELINE_CREATE", description: `Created Pipeline "${body.name}"` });
    ResourceTracker.onCreate(req.params.projectId, "PIPELINE", r.id, body.name ?? r.id).catch(() => {});
    res.status(201).json({ success: true, data: r }); } catch(e) { next(e); }
});

deployRouter.delete("/:projectId/:id", requireProjectAccess, requireProjectWrite, async (req, res, next) => {
  try { const { user } = req as unknown as AuthenticatedRequest;
    await prisma.deliveryPipeline.delete({ where: { id: req.params.id } });
    await logActivity(prisma, req.params.projectId, user.email, { type: "PIPELINE_DELETE", description: `Deleted Pipeline ${req.params.id}`, severity: "WARNING" });
    ResourceTracker.onDelete(req.params.projectId, "PIPELINE", req.params.id ?? req.params.datasetId ?? "", "").catch(() => {});
    res.json({ success: true, data: null }); } catch(e) { next(e); }
});
