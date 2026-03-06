import { Router } from "express";
import { CreateWorkflowSchema } from "@pcg/shared";
import { requireAuth, requireProjectAccess, requireProjectWrite, AuthenticatedRequest } from "../middleware/auth";
import { prisma } from "../lib/prisma";
import { logActivity } from "../services/activityLog";
export const workflowsRouter = Router();
workflowsRouter.use(requireAuth);
workflowsRouter.get("/:projectId", requireProjectAccess, async (req, res, next) => {
  try { res.json({ success: true, data: await prisma.workflow.findMany({ where: { projectId: req.params.projectId }, orderBy: { createdAt: "desc" } }) }); } catch(e) { next(e); }
});

workflowsRouter.post("/:projectId", requireProjectAccess, requireProjectWrite, async (req, res, next) => {
  try { const { user } = req as unknown as AuthenticatedRequest; const body = CreateWorkflowSchema.parse(req.body);
    const r = await prisma.workflow.create({ data: { ...body, projectId: req.params.projectId } });
    await logActivity(prisma, req.params.projectId, user.email, { type: "WORKFLOW_CREATE", description: `Created Workflow "${body.name}"` });
    res.status(201).json({ success: true, data: r }); } catch(e) { next(e); }
});

workflowsRouter.delete("/:projectId/:id", requireProjectAccess, requireProjectWrite, async (req, res, next) => {
  try { const { user } = req as unknown as AuthenticatedRequest;
    await prisma.workflow.delete({ where: { id: req.params.id } });
    await logActivity(prisma, req.params.projectId, user.email, { type: "WORKFLOW_DELETE", description: `Deleted Workflow ${req.params.id}`, severity: "WARNING" });
    res.json({ success: true, data: null }); } catch(e) { next(e); }
});

workflowsRouter.post("/:projectId/:id/execute", requireProjectAccess, requireProjectWrite, async (req, res, next) => {
  try { const { user } = req as unknown as AuthenticatedRequest;
    const w = await prisma.workflow.update({ where: { id: req.params.id }, data: { lastExecStatus: "RUNNING", lastExecutedAt: new Date() } });
    setTimeout(async () => { try { await prisma.workflow.update({ where: { id: w.id }, data: { lastExecStatus: "SUCCEEDED" } }); } catch {} }, 3000);
    await logActivity(prisma, req.params.projectId, user.email, { type: "WORKFLOW_EXECUTE", description: `Executed "${w.name}"` });
    res.json({ success: true, data: w }); } catch(e) { next(e); }
});