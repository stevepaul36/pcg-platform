import { Router } from "express";
import { CreateLogSinkSchema } from "@pcg/shared";
import { requireAuth, requireProjectAccess, requireProjectWrite, AuthenticatedRequest } from "../middleware/auth";
import { prisma } from "../lib/prisma";
import { logActivity } from "../services/activityLog";
export const loggingRouter = Router();
loggingRouter.use(requireAuth);
loggingRouter.get("/:projectId", requireProjectAccess, async (req, res, next) => {
  try { res.json({ success: true, data: await prisma.logSink.findMany({ where: { projectId: req.params.projectId }, orderBy: { createdAt: "desc" } }) }); } catch(e) { next(e); }
});

loggingRouter.post("/:projectId", requireProjectAccess, requireProjectWrite, async (req, res, next) => {
  try { const { user } = req as unknown as AuthenticatedRequest; const body = CreateLogSinkSchema.parse(req.body);
    const r = await prisma.logSink.create({ data: { ...body, projectId: req.params.projectId } });
    await logActivity(prisma, req.params.projectId, user.email, { type: "LOG_SINK_CREATE", description: `Created Log Sink "${body.name}"` });
    res.status(201).json({ success: true, data: r }); } catch(e) { next(e); }
});

loggingRouter.delete("/:projectId/:id", requireProjectAccess, requireProjectWrite, async (req, res, next) => {
  try { const { user } = req as unknown as AuthenticatedRequest;
    await prisma.logSink.delete({ where: { id: req.params.id } });
    await logActivity(prisma, req.params.projectId, user.email, { type: "LOG_SINK_DELETE", description: `Deleted Log Sink ${req.params.id}`, severity: "WARNING" });
    res.json({ success: true, data: null }); } catch(e) { next(e); }
});
