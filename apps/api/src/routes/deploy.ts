// apps/api/src/routes/deploy.ts
import { Router } from "express";
import { CreateDeliveryPipelineSchema } from "@pcg/shared";
import { Prisma } from "@prisma/client";
import { requireAuth, requireProjectAccess, requireProjectWrite, AuthenticatedRequest } from "../middleware/auth";
import { prisma }          from "../lib/prisma";
import { logger }          from "../lib/logger";
import { logActivity }     from "../services/activityLog";
import { ResourceTracker } from "../services/resourceTracker";
import { AppError }        from "../middleware/errorHandler";

export const deployRouter = Router();
deployRouter.use(requireAuth);

deployRouter.get("/:projectId", requireProjectAccess, async (req, res, next) => {
  try {
    const pipelines = await prisma.deliveryPipeline.findMany({
      where: { projectId: req.params.projectId }, orderBy: { createdAt: "desc" },
    });
    res.json({ success: true, data: pipelines });
  } catch (err) { next(err); }
});

deployRouter.post("/:projectId", requireProjectAccess, requireProjectWrite, async (req, res, next) => {
  try {
    const { user } = req as unknown as AuthenticatedRequest;
    const body     = CreateDeliveryPipelineSchema.parse(req.body);

    const pipeline = await prisma.deliveryPipeline.create({
      data: {
        projectId:   req.params.projectId,
        name:        body.name,
        description: body.description,
        region:      body.region,
        stages:      body.stages as unknown as Prisma.InputJsonValue,
      },
    });

    await logActivity(prisma, req.params.projectId, user.email, {
      type: "PIPELINE_CREATE", description: `Created Cloud Deploy pipeline "${body.name}"`, resourceId: pipeline.id,
    });
    ResourceTracker.onCreate(req.params.projectId, "PIPELINE", pipeline.id, pipeline.name).catch((err: unknown) =>
      logger.warn({ err }, "ResourceTracker.onCreate failed"),
    );
    res.status(201).json({ success: true, data: pipeline });
  } catch (err) { next(err); }
});

deployRouter.delete("/:projectId/:id", requireProjectAccess, requireProjectWrite, async (req, res, next) => {
  try {
    const { user } = req as unknown as AuthenticatedRequest;
    const pipeline = await prisma.deliveryPipeline.findFirst({ where: { id: req.params.id, projectId: req.params.projectId } });
    if (!pipeline) throw new AppError(404, "NOT_FOUND", "Delivery pipeline not found");

    await prisma.deliveryPipeline.delete({ where: { id: pipeline.id } });
    await logActivity(prisma, req.params.projectId, user.email, {
      type: "PIPELINE_DELETE", description: `Deleted Cloud Deploy pipeline "${pipeline.name}"`,
      resourceId: pipeline.id, severity: "WARNING",
    });
    ResourceTracker.onDelete(req.params.projectId, "PIPELINE", pipeline.id, pipeline.name).catch((err: unknown) =>
      logger.warn({ err }, "ResourceTracker.onDelete failed"),
    );
    res.json({ success: true, data: null });
  } catch (err) { next(err); }
});
