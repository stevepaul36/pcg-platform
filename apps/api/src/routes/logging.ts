// apps/api/src/routes/logging.ts
import { Router } from "express";
import { CreateLogSinkSchema } from "@pcg/shared";
import { requireAuth, requireProjectAccess, requireProjectWrite, AuthenticatedRequest } from "../middleware/auth";
import { prisma }          from "../lib/prisma";
import { logger }          from "../lib/logger";
import { logActivity }     from "../services/activityLog";
import { ResourceTracker } from "../services/resourceTracker";
import { AppError }        from "../middleware/errorHandler";

export const loggingRouter = Router();
loggingRouter.use(requireAuth);

loggingRouter.get("/:projectId", requireProjectAccess, async (req, res, next) => {
  try {
    const sinks = await prisma.logSink.findMany({
      where: { projectId: req.params.projectId }, orderBy: { createdAt: "desc" },
    });
    res.json({ success: true, data: sinks });
  } catch (err) { next(err); }
});

loggingRouter.post("/:projectId", requireProjectAccess, requireProjectWrite, async (req, res, next) => {
  try {
    const { user } = req as unknown as AuthenticatedRequest;
    const body     = CreateLogSinkSchema.parse(req.body);

    const sink = await prisma.logSink.create({
      data: {
        projectId:   req.params.projectId,
        name:        body.name,
        destination: body.destination,
        filter:      body.filter,
      },
    });

    await logActivity(prisma, req.params.projectId, user.email, {
      type: "LOG_SINK_CREATE", description: `Created log sink "${body.name}"`, resourceId: sink.id,
    });
    ResourceTracker.onCreate(req.params.projectId, "LOG_SINK", sink.id, sink.name).catch((err: unknown) =>
      logger.warn({ err }, "ResourceTracker.onCreate failed"),
    );
    res.status(201).json({ success: true, data: sink });
  } catch (err) { next(err); }
});

loggingRouter.delete("/:projectId/:id", requireProjectAccess, requireProjectWrite, async (req, res, next) => {
  try {
    const { user } = req as unknown as AuthenticatedRequest;
    const sink     = await prisma.logSink.findFirst({ where: { id: req.params.id, projectId: req.params.projectId } });
    if (!sink) throw new AppError(404, "NOT_FOUND", "Log sink not found");

    await prisma.logSink.delete({ where: { id: sink.id } });
    await logActivity(prisma, req.params.projectId, user.email, {
      type: "LOG_SINK_DELETE", description: `Deleted log sink "${sink.name}"`,
      resourceId: sink.id, severity: "WARNING",
    });
    ResourceTracker.onDelete(req.params.projectId, "LOG_SINK", sink.id, sink.name).catch((err: unknown) =>
      logger.warn({ err }, "ResourceTracker.onDelete failed"),
    );
    res.json({ success: true, data: null });
  } catch (err) { next(err); }
});
