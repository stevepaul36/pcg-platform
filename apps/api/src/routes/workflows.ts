// apps/api/src/routes/workflows.ts
import { Router } from "express";
import { CreateWorkflowSchema } from "@pcg/shared";
import { requireAuth, requireProjectAccess, requireProjectWrite, AuthenticatedRequest } from "../middleware/auth";
import { prisma }          from "../lib/prisma";
import { logger }          from "../lib/logger";
import { logActivity }     from "../services/activityLog";
import { ResourceTracker } from "../services/resourceTracker";
import { AppError }        from "../middleware/errorHandler";

export const workflowsRouter = Router();
workflowsRouter.use(requireAuth);

workflowsRouter.get("/:projectId", requireProjectAccess, async (req, res, next) => {
  try {
    const workflows = await prisma.workflow.findMany({
      where: { projectId: req.params.projectId }, orderBy: { createdAt: "desc" },
    });
    res.json({ success: true, data: workflows });
  } catch (err) { next(err); }
});

workflowsRouter.post("/:projectId", requireProjectAccess, requireProjectWrite, async (req, res, next) => {
  try {
    const { user } = req as unknown as AuthenticatedRequest;
    const body     = CreateWorkflowSchema.parse(req.body);

    const workflow = await prisma.workflow.create({
      data: {
        projectId:   req.params.projectId,
        name:        body.name,
        description: body.description,
        region:      body.region,
        sourceCode:  body.sourceCode,
      },
    });

    await logActivity(prisma, req.params.projectId, user.email, {
      type: "WORKFLOW_CREATE", description: `Created Workflow "${body.name}"`,
      resourceId: workflow.id,
    });
    ResourceTracker.onCreate(req.params.projectId, "WORKFLOW", workflow.id, workflow.name).catch((err: unknown) =>
      logger.warn({ err }, "ResourceTracker.onCreate failed"),
    );
    res.status(201).json({ success: true, data: workflow });
  } catch (err) { next(err); }
});

workflowsRouter.post("/:projectId/:id/execute", requireProjectAccess, requireProjectWrite, async (req, res, next) => {
  try {
    const { user } = req as unknown as AuthenticatedRequest;
    const workflow = await prisma.workflow.findFirst({ where: { id: req.params.id, projectId: req.params.projectId } });
    if (!workflow) throw new AppError(404, "NOT_FOUND", "Workflow not found");

    const updated = await prisma.workflow.update({
      where: { id: workflow.id },
      data:  { lastExecStatus: "RUNNING", lastExecutedAt: new Date() },
    });

    setTimeout(async () => {
      try { await prisma.workflow.update({ where: { id: workflow.id }, data: { lastExecStatus: "SUCCEEDED" } }); }
      catch (e) { logger.error({ err: e, workflowId: workflow.id }, "Failed to mark workflow as SUCCEEDED"); }
    }, 3_000);

    await logActivity(prisma, req.params.projectId, user.email, {
      type: "WORKFLOW_EXECUTE", description: `Executed workflow "${workflow.name}"`,
      resourceId: workflow.id,
    });
    res.json({ success: true, data: updated });
  } catch (err) { next(err); }
});

workflowsRouter.delete("/:projectId/:id", requireProjectAccess, requireProjectWrite, async (req, res, next) => {
  try {
    const { user } = req as unknown as AuthenticatedRequest;
    const workflow = await prisma.workflow.findFirst({ where: { id: req.params.id, projectId: req.params.projectId } });
    if (!workflow) throw new AppError(404, "NOT_FOUND", "Workflow not found");

    await prisma.workflow.delete({ where: { id: workflow.id } });
    await logActivity(prisma, req.params.projectId, user.email, {
      type: "WORKFLOW_DELETE", description: `Deleted workflow "${workflow.name}"`,
      resourceId: workflow.id, severity: "WARNING",
    });
    ResourceTracker.onDelete(req.params.projectId, "WORKFLOW", workflow.id, workflow.name).catch((err: unknown) =>
      logger.warn({ err }, "ResourceTracker.onDelete failed"),
    );
    res.json({ success: true, data: null });
  } catch (err) { next(err); }
});
