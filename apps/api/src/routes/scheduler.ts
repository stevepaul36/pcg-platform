// apps/api/src/routes/scheduler.ts
import { Router } from "express";
import { z }      from "zod";
import { CreateSchedulerJobSchema } from "@pcg/shared";
import { requireAuth, requireProjectAccess, requireProjectWrite, AuthenticatedRequest } from "../middleware/auth";
import { prisma }          from "../lib/prisma";
import { logger }          from "../lib/logger";
import { logActivity }     from "../services/activityLog";
import { ResourceTracker } from "../services/resourceTracker";
import { AppError }        from "../middleware/errorHandler";

export const schedulerRouter = Router();
schedulerRouter.use(requireAuth);

schedulerRouter.get("/:projectId", requireProjectAccess, async (req, res, next) => {
  try {
    const jobs = await prisma.schedulerJob.findMany({
      where: { projectId: req.params.projectId }, orderBy: { createdAt: "desc" },
    });
    res.json({ success: true, data: jobs });
  } catch (err) { next(err); }
});

schedulerRouter.post("/:projectId", requireProjectAccess, requireProjectWrite, async (req, res, next) => {
  try {
    const { user } = req as unknown as AuthenticatedRequest;
    const body     = CreateSchedulerJobSchema.parse(req.body);

    const job = await prisma.schedulerJob.create({
      data: {
        projectId:   req.params.projectId,
        name:        body.name,
        description: body.description,
        schedule:    body.schedule,
        timezone:    body.timezone,
        targetType:  body.targetType,
        targetUri:   body.targetUri,
        httpMethod:  body.httpMethod,
      },
    });

    await logActivity(prisma, req.params.projectId, user.email, {
      type: "SCHEDULER_JOB_CREATE", description: `Created scheduler job "${body.name}" (${body.schedule})`,
      resourceId: job.id,
    });
    ResourceTracker.onCreate(req.params.projectId, "SCHEDULER_JOB", job.id, job.name).catch((err: unknown) =>
      logger.warn({ err }, "ResourceTracker.onCreate failed"),
    );
    res.status(201).json({ success: true, data: job });
  } catch (err) { next(err); }
});

const PatchJobSchema = z.object({
  status: z.enum(["ENABLED", "PAUSED"]),
});

schedulerRouter.patch("/:projectId/:jobId", requireProjectAccess, requireProjectWrite, async (req, res, next) => {
  try {
    const { user } = req as unknown as AuthenticatedRequest;
    const { status } = PatchJobSchema.parse(req.body);

    const job = await prisma.schedulerJob.findFirst({ where: { id: req.params.jobId, projectId: req.params.projectId } });
    if (!job) throw new AppError(404, "NOT_FOUND", "Scheduler job not found");

    const updated = await prisma.schedulerJob.update({ where: { id: job.id }, data: { status } });
    await logActivity(prisma, req.params.projectId, user.email, {
      type: "SCHEDULER_JOB_UPDATE",
      description: `${status === "PAUSED" ? "Paused" : "Resumed"} scheduler job "${job.name}"`,
      resourceId: job.id,
    });
    res.json({ success: true, data: updated });
  } catch (err) { next(err); }
});

schedulerRouter.delete("/:projectId/:jobId", requireProjectAccess, requireProjectWrite, async (req, res, next) => {
  try {
    const { user } = req as unknown as AuthenticatedRequest;
    const job      = await prisma.schedulerJob.findFirst({ where: { id: req.params.jobId, projectId: req.params.projectId } });
    if (!job) throw new AppError(404, "NOT_FOUND", "Scheduler job not found");

    await prisma.schedulerJob.delete({ where: { id: job.id } });
    await logActivity(prisma, req.params.projectId, user.email, {
      type: "SCHEDULER_JOB_DELETE", description: `Deleted scheduler job "${job.name}"`,
      resourceId: job.id, severity: "WARNING",
    });
    ResourceTracker.onDelete(req.params.projectId, "SCHEDULER_JOB", job.id, job.name).catch((err: unknown) =>
      logger.warn({ err }, "ResourceTracker.onDelete failed"),
    );
    res.json({ success: true, data: null });
  } catch (err) { next(err); }
});
