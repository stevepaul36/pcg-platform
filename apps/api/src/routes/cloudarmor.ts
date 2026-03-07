// apps/api/src/routes/cloudarmor.ts
import { Router } from "express";
import { CreateCloudArmorSchema } from "@pcg/shared";
import { Prisma } from "@prisma/client";
import { requireAuth, requireProjectAccess, requireProjectWrite, AuthenticatedRequest } from "../middleware/auth";
import { prisma }          from "../lib/prisma";
import { logger }          from "../lib/logger";
import { logActivity }     from "../services/activityLog";
import { ResourceTracker } from "../services/resourceTracker";
import { AppError }        from "../middleware/errorHandler";

export const cloudarmorRouter = Router();
cloudarmorRouter.use(requireAuth);

cloudarmorRouter.get("/:projectId", requireProjectAccess, async (req, res, next) => {
  try {
    const policies = await prisma.cloudArmorPolicy.findMany({
      where: { projectId: req.params.projectId }, orderBy: { createdAt: "desc" },
    });
    res.json({ success: true, data: policies });
  } catch (err) { next(err); }
});

cloudarmorRouter.post("/:projectId", requireProjectAccess, requireProjectWrite, async (req, res, next) => {
  try {
    const { user } = req as unknown as AuthenticatedRequest;
    const body     = CreateCloudArmorSchema.parse(req.body);

    const defaultRule = [{ priority: 2147483647, action: body.defaultAction, match: "*", description: "Default rule" }];

    const policy = await prisma.cloudArmorPolicy.create({
      data: {
        projectId:          req.params.projectId,
        name:               body.name,
        description:        body.description,
        type:               body.type,
        defaultAction:      body.defaultAction,
        adaptiveProtection: body.adaptiveProtection,
        rules:              defaultRule as unknown as Prisma.InputJsonValue,
      },
    });

    await logActivity(prisma, req.params.projectId, user.email, {
      type: "ARMOR_POLICY_CREATE", description: `Created Cloud Armor policy "${body.name}"`, resourceId: policy.id,
    });
    ResourceTracker.onCreate(req.params.projectId, "CLOUD_ARMOR", policy.id, policy.name).catch((err: unknown) =>
      logger.warn({ err }, "ResourceTracker.onCreate failed"),
    );
    res.status(201).json({ success: true, data: policy });
  } catch (err) { next(err); }
});

cloudarmorRouter.delete("/:projectId/:policyId", requireProjectAccess, requireProjectWrite, async (req, res, next) => {
  try {
    const { user } = req as unknown as AuthenticatedRequest;
    const policy   = await prisma.cloudArmorPolicy.findFirst({ where: { id: req.params.policyId, projectId: req.params.projectId } });
    if (!policy) throw new AppError(404, "NOT_FOUND", "Cloud Armor policy not found");

    await prisma.cloudArmorPolicy.delete({ where: { id: policy.id } });
    await logActivity(prisma, req.params.projectId, user.email, {
      type: "ARMOR_POLICY_DELETE", description: `Deleted Cloud Armor policy "${policy.name}"`,
      resourceId: policy.id, severity: "WARNING",
    });
    ResourceTracker.onDelete(req.params.projectId, "CLOUD_ARMOR", policy.id, policy.name).catch((err: unknown) =>
      logger.warn({ err }, "ResourceTracker.onDelete failed"),
    );
    res.json({ success: true, data: null });
  } catch (err) { next(err); }
});
