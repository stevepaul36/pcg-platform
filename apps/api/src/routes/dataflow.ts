// apps/api/src/routes/dataflow.ts
import { Router } from "express";
import { CreateDataflowJobSchema } from "@pcg/shared";
import { prisma } from "../lib/prisma";
import { requireAuth, requireProjectAccess, requireProjectWrite, AuthenticatedRequest } from "../middleware/auth";
import { AppError } from "../middleware/errorHandler";
import { logActivity } from "../services/activityLog";

export const dataflowRouter = Router();
dataflowRouter.use(requireAuth);

dataflowRouter.get("/:projectId", requireProjectAccess, async (req, res, next) => {
  try {
    const jobs = await prisma.dataflowJob.findMany({ where: { projectId: req.params.projectId }, orderBy: { startedAt: "desc" } });
    res.json({ success: true, data: jobs });
  } catch (err) { next(err); }
});

dataflowRouter.post("/:projectId", requireProjectAccess, requireProjectWrite, async (req, res, next) => {
  try {
    const body = CreateDataflowJobSchema.parse(req.body);
    const { user } = req as unknown as AuthenticatedRequest;
    const hourlyCost = body.workers * 0.056; // n1-standard-1 Dataflow worker cost
    const job = await prisma.dataflowJob.create({
      data: { ...body, projectId: req.params.projectId, status: "JOB_STATE_RUNNING", hourlyCost },
    });
    await logActivity(prisma, req.params.projectId, user.email, { type: "DATAFLOW_JOB_CREATE", description: `Started Dataflow job ${body.name}`, resourceId: job.id, severity: "INFO" });
    res.status(201).json({ success: true, data: job });
  } catch (err) { next(err); }
});

// Cancel/drain job
dataflowRouter.post("/:projectId/:jobId/cancel", requireProjectAccess, requireProjectWrite, async (req, res, next) => {
  try {
    const { user } = req as unknown as AuthenticatedRequest;
    const job = await prisma.dataflowJob.findFirst({ where: { id: req.params.jobId, projectId: req.params.projectId } });
    if (!job) throw new AppError(404, "NOT_FOUND", "Job not found");
    const updated = await prisma.dataflowJob.update({ where: { id: job.id }, data: { status: "JOB_STATE_CANCELLED" } });
    await logActivity(prisma, req.params.projectId, user.email, { type: "DATAFLOW_JOB_CANCEL", description: `Cancelled Dataflow job ${job.name}`, resourceId: job.id, severity: "WARNING" });
    res.json({ success: true, data: updated });
  } catch (err) { next(err); }
});

dataflowRouter.delete("/:projectId/:jobId", requireProjectAccess, requireProjectWrite, async (req, res, next) => {
  try {
    const { user } = req as unknown as AuthenticatedRequest;
    const job = await prisma.dataflowJob.findFirst({ where: { id: req.params.jobId, projectId: req.params.projectId } });
    if (!job) throw new AppError(404, "NOT_FOUND", "Job not found");
    await prisma.dataflowJob.delete({ where: { id: job.id } });
    await logActivity(prisma, req.params.projectId, user.email, { type: "DATAFLOW_JOB_DELETE", description: `Deleted Dataflow job ${job.name}`, resourceId: job.id, severity: "WARNING" });
    res.json({ success: true });
  } catch (err) { next(err); }
});
