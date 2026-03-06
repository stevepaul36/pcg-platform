import { Router } from "express";
import { CreateSchedulerJobSchema } from "@pcg/shared";
import { requireAuth, requireProjectAccess, requireProjectWrite, AuthenticatedRequest } from "../middleware/auth";
import { prisma } from "../lib/prisma";
import { logActivity } from "../services/activityLog";
import { ResourceTracker } from "../services/resourceTracker";
export const schedulerRouter = Router();
schedulerRouter.use(requireAuth);
schedulerRouter.get("/:projectId", requireProjectAccess, async (req, res, next) => {
  try { res.json({ success: true, data: await prisma.schedulerJob.findMany({ where: { projectId: req.params.projectId }, orderBy: { createdAt: "desc" } }) }); } catch(e) { next(e); }
});
schedulerRouter.post("/:projectId", requireProjectAccess, requireProjectWrite, async (req, res, next) => {
  try { const { user } = req as unknown as AuthenticatedRequest; const body = CreateSchedulerJobSchema.parse(req.body);
    const j = await prisma.schedulerJob.create({ data: { ...body, projectId: req.params.projectId } });
    await logActivity(prisma, req.params.projectId, user.email, { type: "SCHEDULER_JOB_CREATE", description: `Created scheduler job "${body.name}" (${body.schedule})` });
    ResourceTracker.onCreate(req.params.projectId, "SCHEDULER_JOB", r.id, body.name ?? r.id).catch(() => {});
    res.status(201).json({ success: true, data: j }); } catch(e) { next(e); }
});
schedulerRouter.patch("/:projectId/:jobId", requireProjectAccess, requireProjectWrite, async (req, res, next) => {
  try { const { user } = req as unknown as AuthenticatedRequest; const status = req.body.status === "PAUSED" ? "PAUSED" : "ENABLED";
    const j = await prisma.schedulerJob.update({ where: { id: req.params.jobId }, data: { status } });
    await logActivity(prisma, req.params.projectId, user.email, { type: "SCHEDULER_JOB_UPDATE", description: `${status === "PAUSED" ? "Paused" : "Resumed"} job "${j.name}"` });
    res.json({ success: true, data: j }); } catch(e) { next(e); }
});
schedulerRouter.delete("/:projectId/:jobId", requireProjectAccess, requireProjectWrite, async (req, res, next) => {
  try { const { user } = req as unknown as AuthenticatedRequest;
    await prisma.schedulerJob.delete({ where: { id: req.params.jobId } });
    await logActivity(prisma, req.params.projectId, user.email, { type: "SCHEDULER_JOB_DELETE", description: `Deleted scheduler job ${req.params.jobId}` });
    ResourceTracker.onDelete(req.params.projectId, "SCHEDULER_JOB", req.params.id ?? req.params.datasetId ?? "", "").catch(() => {});
    res.json({ success: true, data: null }); } catch(e) { next(e); }
});
