import { Router } from "express";
import { CreateBuildTriggerSchema } from "@pcg/shared";
import { requireAuth, requireProjectAccess, requireProjectWrite, AuthenticatedRequest } from "../middleware/auth";
import { prisma } from "../lib/prisma";
import { logActivity } from "../services/activityLog";
import { ResourceTracker } from "../services/resourceTracker";
export const cloudbuildRouter = Router();
cloudbuildRouter.use(requireAuth);
cloudbuildRouter.get("/:projectId", requireProjectAccess, async (req, res, next) => {
  try { res.json({ success: true, data: await prisma.cloudBuildTrigger.findMany({ where: { projectId: req.params.projectId }, orderBy: { createdAt: "desc" } }) }); } catch(e) { next(e); }
});
cloudbuildRouter.post("/:projectId", requireProjectAccess, requireProjectWrite, async (req, res, next) => {
  try { const { user } = req as unknown as AuthenticatedRequest; const body = CreateBuildTriggerSchema.parse(req.body);
    const t = await prisma.cloudBuildTrigger.create({ data: { ...body, projectId: req.params.projectId } });
    await logActivity(prisma, req.params.projectId, user.email, { type: "BUILD_TRIGGER_CREATE", description: `Created build trigger "${body.name}"` });
    ResourceTracker.onCreate(req.params.projectId, "BUILD_TRIGGER", r.id, body.name ?? r.id).catch(() => {});
    res.status(201).json({ success: true, data: t }); } catch(e) { next(e); }
});
cloudbuildRouter.delete("/:projectId/:triggerId", requireProjectAccess, requireProjectWrite, async (req, res, next) => {
  try { const { user } = req as unknown as AuthenticatedRequest;
    await prisma.cloudBuildTrigger.delete({ where: { id: req.params.triggerId } });
    await logActivity(prisma, req.params.projectId, user.email, { type: "BUILD_TRIGGER_DELETE", description: `Deleted build trigger ${req.params.triggerId}` });
    ResourceTracker.onDelete(req.params.projectId, "BUILD_TRIGGER", req.params.id ?? req.params.datasetId ?? "", "").catch(() => {});
    res.json({ success: true, data: null }); } catch(e) { next(e); }
});
