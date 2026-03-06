import { Router } from "express";
import { CreateTaskQueueSchema } from "@pcg/shared";
import { requireAuth, requireProjectAccess, requireProjectWrite, AuthenticatedRequest } from "../middleware/auth";
import { prisma } from "../lib/prisma";
import { logActivity } from "../services/activityLog";
export const tasksRouter = Router();
tasksRouter.use(requireAuth);
tasksRouter.get("/:projectId", requireProjectAccess, async (req, res, next) => {
  try { res.json({ success: true, data: await prisma.taskQueue.findMany({ where: { projectId: req.params.projectId }, orderBy: { createdAt: "desc" } }) }); } catch(e) { next(e); }
});

tasksRouter.post("/:projectId", requireProjectAccess, requireProjectWrite, async (req, res, next) => {
  try { const { user } = req as unknown as AuthenticatedRequest; const body = CreateTaskQueueSchema.parse(req.body);
    const r = await prisma.taskQueue.create({ data: { ...body, projectId: req.params.projectId } });
    await logActivity(prisma, req.params.projectId, user.email, { type: "TASK_QUEUE_CREATE", description: `Created Task Queue "${body.name}"` });
    res.status(201).json({ success: true, data: r }); } catch(e) { next(e); }
});

tasksRouter.delete("/:projectId/:id", requireProjectAccess, requireProjectWrite, async (req, res, next) => {
  try { const { user } = req as unknown as AuthenticatedRequest;
    await prisma.taskQueue.delete({ where: { id: req.params.id } });
    await logActivity(prisma, req.params.projectId, user.email, { type: "TASK_QUEUE_DELETE", description: `Deleted Task Queue ${req.params.id}`, severity: "WARNING" });
    res.json({ success: true, data: null }); } catch(e) { next(e); }
});

tasksRouter.patch("/:projectId/:id", requireProjectAccess, requireProjectWrite, async (req, res, next) => {
  try { const { user } = req as unknown as AuthenticatedRequest;
    const status = req.body.status === "PAUSED" ? "PAUSED" : "RUNNING";
    const q = await prisma.taskQueue.update({ where: { id: req.params.id }, data: { status } });
    await logActivity(prisma, req.params.projectId, user.email, { type: "TASK_QUEUE_UPDATE", description: `${status} queue "${q.name}"` });
    res.json({ success: true, data: q }); } catch(e) { next(e); }
});