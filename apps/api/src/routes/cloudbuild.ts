// apps/api/src/routes/cloudbuild.ts
import { Router } from "express";
import { CreateBuildTriggerSchema } from "@pcg/shared";
import { requireAuth, requireProjectAccess, requireProjectWrite, AuthenticatedRequest } from "../middleware/auth";
import { prisma }          from "../lib/prisma";
import { logger }          from "../lib/logger";
import { logActivity }     from "../services/activityLog";
import { ResourceTracker } from "../services/resourceTracker";
import { AppError }        from "../middleware/errorHandler";

export const cloudbuildRouter = Router();
cloudbuildRouter.use(requireAuth);

cloudbuildRouter.get("/:projectId", requireProjectAccess, async (req, res, next) => {
  try {
    const triggers = await prisma.cloudBuildTrigger.findMany({
      where: { projectId: req.params.projectId }, orderBy: { createdAt: "desc" },
    });
    res.json({ success: true, data: triggers });
  } catch (err) { next(err); }
});

cloudbuildRouter.post("/:projectId", requireProjectAccess, requireProjectWrite, async (req, res, next) => {
  try {
    const { user } = req as unknown as AuthenticatedRequest;
    const body     = CreateBuildTriggerSchema.parse(req.body);

    const trigger = await prisma.cloudBuildTrigger.create({
      data: {
        projectId:     req.params.projectId,
        name:          body.name,
        description:   body.description,
        repoSource:    body.repoSource,
        branchPattern: body.branchPattern,
        buildSteps:    body.buildSteps,
      },
    });

    await logActivity(prisma, req.params.projectId, user.email, {
      type: "BUILD_TRIGGER_CREATE", description: `Created Cloud Build trigger "${body.name}"`, resourceId: trigger.id,
    });
    ResourceTracker.onCreate(req.params.projectId, "BUILD_TRIGGER", trigger.id, trigger.name).catch((err: unknown) =>
      logger.warn({ err }, "ResourceTracker.onCreate failed"),
    );
    res.status(201).json({ success: true, data: trigger });
  } catch (err) { next(err); }
});

cloudbuildRouter.delete("/:projectId/:triggerId", requireProjectAccess, requireProjectWrite, async (req, res, next) => {
  try {
    const { user } = req as unknown as AuthenticatedRequest;
    const trigger  = await prisma.cloudBuildTrigger.findFirst({ where: { id: req.params.triggerId, projectId: req.params.projectId } });
    if (!trigger) throw new AppError(404, "NOT_FOUND", "Build trigger not found");

    await prisma.cloudBuildTrigger.delete({ where: { id: trigger.id } });
    await logActivity(prisma, req.params.projectId, user.email, {
      type: "BUILD_TRIGGER_DELETE", description: `Deleted Cloud Build trigger "${trigger.name}"`,
      resourceId: trigger.id, severity: "WARNING",
    });
    ResourceTracker.onDelete(req.params.projectId, "BUILD_TRIGGER", trigger.id, trigger.name).catch((err: unknown) =>
      logger.warn({ err }, "ResourceTracker.onDelete failed"),
    );
    res.json({ success: true, data: null });
  } catch (err) { next(err); }
});
