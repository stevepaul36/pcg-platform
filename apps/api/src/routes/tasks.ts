// apps/api/src/routes/tasks.ts
import { Router } from "express";
import { z }      from "zod";
import { CreateTaskQueueSchema } from "@pcg/shared";
import { requireAuth, requireProjectAccess, requireProjectWrite, AuthenticatedRequest } from "../middleware/auth";
import { prisma }          from "../lib/prisma";
import { logger }          from "../lib/logger";
import { logActivity }     from "../services/activityLog";
import { ResourceTracker } from "../services/resourceTracker";
import { AppError }        from "../middleware/errorHandler";

export const tasksRouter = Router();
tasksRouter.use(requireAuth);

tasksRouter.get("/:projectId", requireProjectAccess, async (req, res, next) => {
  try {
    const queues = await prisma.taskQueue.findMany({
      where: { projectId: req.params.projectId }, orderBy: { createdAt: "desc" },
    });
    res.json({ success: true, data: queues });
  } catch (err) { next(err); }
});

tasksRouter.post("/:projectId", requireProjectAccess, requireProjectWrite, async (req, res, next) => {
  try {
    const { user } = req as unknown as AuthenticatedRequest;
    const body     = CreateTaskQueueSchema.parse(req.body);

    const queue = await prisma.taskQueue.create({
      data: {
        projectId:          req.params.projectId,
        name:               body.name,
        region:             body.region,
        rateLimitPerSecond: body.rateLimitPerSecond,
        maxConcurrent:      body.maxConcurrent,
        retryMaxAttempts:   body.retryMaxAttempts,
      },
    });

    await logActivity(prisma, req.params.projectId, user.email, {
      type: "TASK_QUEUE_CREATE", description: `Created Cloud Tasks queue "${body.name}"`,
      resourceId: queue.id,
    });
    ResourceTracker.onCreate(req.params.projectId, "TASK_QUEUE", queue.id, queue.name).catch((err: unknown) =>
      logger.warn({ err }, "ResourceTracker.onCreate failed"),
    );
    res.status(201).json({ success: true, data: queue });
  } catch (err) { next(err); }
});

const PatchQueueSchema = z.object({
  status: z.enum(["RUNNING", "PAUSED"]),
});

tasksRouter.patch("/:projectId/:id", requireProjectAccess, requireProjectWrite, async (req, res, next) => {
  try {
    const { user }   = req as unknown as AuthenticatedRequest;
    const { status } = PatchQueueSchema.parse(req.body);

    const queue = await prisma.taskQueue.findFirst({ where: { id: req.params.id, projectId: req.params.projectId } });
    if (!queue) throw new AppError(404, "NOT_FOUND", "Task queue not found");

    const updated = await prisma.taskQueue.update({ where: { id: queue.id }, data: { status } });
    await logActivity(prisma, req.params.projectId, user.email, {
      type: "TASK_QUEUE_UPDATE", description: `${status === "PAUSED" ? "Paused" : "Resumed"} queue "${queue.name}"`,
      resourceId: queue.id,
    });
    res.json({ success: true, data: updated });
  } catch (err) { next(err); }
});

tasksRouter.delete("/:projectId/:id", requireProjectAccess, requireProjectWrite, async (req, res, next) => {
  try {
    const { user } = req as unknown as AuthenticatedRequest;
    const queue    = await prisma.taskQueue.findFirst({ where: { id: req.params.id, projectId: req.params.projectId } });
    if (!queue) throw new AppError(404, "NOT_FOUND", "Task queue not found");

    await prisma.taskQueue.delete({ where: { id: queue.id } });
    await logActivity(prisma, req.params.projectId, user.email, {
      type: "TASK_QUEUE_DELETE", description: `Deleted Cloud Tasks queue "${queue.name}"`,
      resourceId: queue.id, severity: "WARNING",
    });
    ResourceTracker.onDelete(req.params.projectId, "TASK_QUEUE", queue.id, queue.name).catch((err: unknown) =>
      logger.warn({ err }, "ResourceTracker.onDelete failed"),
    );
    res.json({ success: true, data: null });
  } catch (err) { next(err); }
});
