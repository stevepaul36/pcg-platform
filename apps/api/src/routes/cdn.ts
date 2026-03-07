// apps/api/src/routes/cdn.ts
import { Router } from "express";
import { CreateCDNConfigSchema } from "@pcg/shared";
import { requireAuth, requireProjectAccess, requireProjectWrite, AuthenticatedRequest } from "../middleware/auth";
import { prisma }          from "../lib/prisma";
import { logger }          from "../lib/logger";
import { logActivity }     from "../services/activityLog";
import { ResourceTracker } from "../services/resourceTracker";
import { AppError }        from "../middleware/errorHandler";

export const cdnRouter = Router();
cdnRouter.use(requireAuth);

cdnRouter.get("/:projectId", requireProjectAccess, async (req, res, next) => {
  try {
    const configs = await prisma.cDNConfig.findMany({
      where: { projectId: req.params.projectId }, orderBy: { createdAt: "desc" },
    });
    res.json({ success: true, data: configs });
  } catch (err) { next(err); }
});

cdnRouter.post("/:projectId", requireProjectAccess, requireProjectWrite, async (req, res, next) => {
  try {
    const { user } = req as unknown as AuthenticatedRequest;
    const body     = CreateCDNConfigSchema.parse(req.body);

    const config = await prisma.cDNConfig.create({
      data: {
        projectId:     req.params.projectId,
        name:          body.name,
        originUrl:     body.originUrl,
        cacheMode:     body.cacheMode,
        defaultTtlSec: body.defaultTtlSec,
      },
    });

    await logActivity(prisma, req.params.projectId, user.email, {
      type: "CDN_CREATE", description: `Created CDN config "${body.name}"`, resourceId: config.id,
    });
    ResourceTracker.onCreate(req.params.projectId, "CDN", config.id, config.name).catch((err: unknown) =>
      logger.warn({ err }, "ResourceTracker.onCreate failed"),
    );
    res.status(201).json({ success: true, data: config });
  } catch (err) { next(err); }
});

cdnRouter.delete("/:projectId/:id", requireProjectAccess, requireProjectWrite, async (req, res, next) => {
  try {
    const { user } = req as unknown as AuthenticatedRequest;
    const config   = await prisma.cDNConfig.findFirst({ where: { id: req.params.id, projectId: req.params.projectId } });
    if (!config) throw new AppError(404, "NOT_FOUND", "CDN config not found");

    await prisma.cDNConfig.delete({ where: { id: config.id } });
    await logActivity(prisma, req.params.projectId, user.email, {
      type: "CDN_DELETE", description: `Deleted CDN config "${config.name}"`,
      resourceId: config.id, severity: "WARNING",
    });
    ResourceTracker.onDelete(req.params.projectId, "CDN", config.id, config.name).catch((err: unknown) =>
      logger.warn({ err }, "ResourceTracker.onDelete failed"),
    );
    res.json({ success: true, data: null });
  } catch (err) { next(err); }
});
