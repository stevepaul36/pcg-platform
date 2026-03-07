// apps/api/src/routes/dataflow.ts
import { Router } from "express";
import { CreateDataflowJobSchema } from "@pcg/shared";
import { prisma }          from "../lib/prisma";
import { requireAuth, requireProjectAccess, requireProjectWrite, AuthenticatedRequest } from "../middleware/auth";
import { AppError }        from "../middleware/errorHandler";
import { logActivity }     from "../services/activityLog";
import { ResourceTracker } from "../services/resourceTracker";
import { logger }          from "../lib/logger";

export const dataflowRouter = Router();
dataflowRouter.use(requireAuth);

dataflowRouter.get("/:projectId", requireProjectAccess, async (req, res, next) => {
  try {
    const jobs = await prisma.dataflowJob.findMany({
      where: { projectId: req.params.projectId }, orderBy: { startedAt: "desc" },
    });
    res.json({ success: true, data: jobs });
  } catch (err) { next(err); }
});

dataflowRouter.post("/:projectId", requireProjectAccess, requireProjectWrite, async (req, res, next) => {
  try {
    const body     = CreateDataflowJobSchema.parse(req.body);
    const { user } = req as unknown as AuthenticatedRequest;

    const hourlyCost = body.workers * 0.056; // n1-standard-1 Dataflow worker rate

    const job = await prisma.dataflowJob.create({
      data: {
        projectId:   req.params.projectId,
        name:        body.name,
        template:    body.template,
        region:      body.region,
        workers:     body.workers,
        maxWorkers:  body.maxWorkers,
        status:      "JOB_STATE_RUNNING",
        hourlyCost,
      },
    });

    await logActivity(prisma, req.params.projectId, user.email, {
      type: "DATAFLOW_JOB_CREATE", description: `Started Dataflow job "${body.name}"`,
      resourceId: job.id, metadata: { workers: body.workers, hourlyCost },
    });
    ResourceTracker.onCreate(req.params.projectId, "DATAFLOW_JOB", job.id, job.name, hourlyCost).catch((err: unknown) =>
      logger.warn({ err }, "ResourceTracker.onCreate failed"),
    );
    res.status(201).json({ success: true, data: job });
  } catch (err) { next(err); }
});

dataflowRouter.post("/:projectId/:jobId/cancel", requireProjectAccess, requireProjectWrite, async (req, res, next) => {
  try {
    const { user } = req as unknown as AuthenticatedRequest;
    const job = await prisma.dataflowJob.findFirst({ where: { id: req.params.jobId, projectId: req.params.projectId } });
    if (!job) throw new AppError(404, "NOT_FOUND", "Dataflow job not found");
    if (job.status !== "JOB_STATE_RUNNING") throw new AppError(409, "INVALID_STATE", "Only running jobs can be cancelled");

    const updated = await prisma.dataflowJob.update({ where: { id: job.id }, data: { status: "JOB_STATE_CANCELLED" } });
    await logActivity(prisma, req.params.projectId, user.email, {
      type: "DATAFLOW_JOB_CANCEL", description: `Cancelled Dataflow job "${job.name}"`,
      resourceId: job.id, severity: "WARNING",
    });
    res.json({ success: true, data: updated });
  } catch (err) { next(err); }
});

dataflowRouter.delete("/:projectId/:jobId", requireProjectAccess, requireProjectWrite, async (req, res, next) => {
  try {
    const { user } = req as unknown as AuthenticatedRequest;
    const job = await prisma.dataflowJob.findFirst({ where: { id: req.params.jobId, projectId: req.params.projectId } });
    if (!job) throw new AppError(404, "NOT_FOUND", "Dataflow job not found");

    await prisma.dataflowJob.delete({ where: { id: job.id } });
    await logActivity(prisma, req.params.projectId, user.email, {
      type: "DATAFLOW_JOB_DELETE", description: `Deleted Dataflow job "${job.name}"`,
      resourceId: job.id, severity: "WARNING",
    });
    ResourceTracker.onDelete(req.params.projectId, "DATAFLOW_JOB", job.id, job.name).catch((err: unknown) =>
      logger.warn({ err }, "ResourceTracker.onDelete failed"),
    );
    res.json({ success: true, data: null });
  } catch (err) { next(err); }
});
