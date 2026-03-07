// apps/api/src/routes/memorystore.ts
import { Router } from "express";
import { CreateMemorystoreSchema } from "@pcg/shared";
import { requireAuth, requireProjectAccess, requireProjectWrite, AuthenticatedRequest } from "../middleware/auth";
import { prisma }          from "../lib/prisma";
import { logger }          from "../lib/logger";
import { logActivity }     from "../services/activityLog";
import { ResourceTracker } from "../services/resourceTracker";
import { AppError }        from "../middleware/errorHandler";

export const memorystoreRouter = Router();
memorystoreRouter.use(requireAuth);

// Memorystore hourly cost: per-GB rate differs by tier (us-central1 pricing)
const TIER_RATE: Record<string, number> = { BASIC: 0.049, STANDARD_HA: 0.098 };

memorystoreRouter.get("/:projectId", requireProjectAccess, async (req, res, next) => {
  try {
    const instances = await prisma.memorystoreInstance.findMany({
      where: { projectId: req.params.projectId }, orderBy: { createdAt: "desc" },
    });
    res.json({ success: true, data: instances });
  } catch (err) { next(err); }
});

memorystoreRouter.post("/:projectId", requireProjectAccess, requireProjectWrite, async (req, res, next) => {
  try {
    const { user } = req as unknown as AuthenticatedRequest;
    const body     = CreateMemorystoreSchema.parse(req.body);

    const hourlyCost       = (TIER_RATE[body.tier] ?? 0.049) * body.memorySizeGb;
    const highAvailability = body.tier === "STANDARD_HA";
    const port             = body.engine === "REDIS" ? 6379 : 11211;
    const host             = `10.${Math.floor(Math.random() * 200) + 10}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;

    const instance = await prisma.memorystoreInstance.create({
      data: {
        projectId:        req.params.projectId,
        name:             body.name,
        engine:           body.engine,
        version:          body.version,
        tier:             body.tier,
        memorySizeGb:     body.memorySizeGb,
        region:           body.region,
        host,
        port,
        highAvailability,
        hourlyCost,
      },
    });

    setTimeout(async () => {
      try { await prisma.memorystoreInstance.update({ where: { id: instance.id }, data: { status: "READY" } }); }
      catch (e) { logger.error({ err: e, instanceId: instance.id }, "Failed to transition Memorystore to READY"); }
    }, 3_000);

    await logActivity(prisma, req.params.projectId, user.email, {
      type: "MEMORYSTORE_CREATE",
      description: `Created ${body.engine} instance "${body.name}" (${body.memorySizeGb} GB, ${body.tier})`,
      resourceId: instance.id, metadata: { hourlyCost },
    });
    ResourceTracker.onCreate(req.params.projectId, "MEMORYSTORE", instance.id, instance.name, hourlyCost).catch((err: unknown) =>
      logger.warn({ err }, "ResourceTracker.onCreate failed"),
    );
    res.status(201).json({ success: true, data: instance });
  } catch (err) { next(err); }
});

memorystoreRouter.delete("/:projectId/:instId", requireProjectAccess, requireProjectWrite, async (req, res, next) => {
  try {
    const { user } = req as unknown as AuthenticatedRequest;
    const instance = await prisma.memorystoreInstance.findFirst({ where: { id: req.params.instId, projectId: req.params.projectId } });
    if (!instance) throw new AppError(404, "NOT_FOUND", "Memorystore instance not found");

    await prisma.memorystoreInstance.delete({ where: { id: instance.id } });
    await logActivity(prisma, req.params.projectId, user.email, {
      type: "MEMORYSTORE_DELETE", description: `Deleted ${instance.engine} instance "${instance.name}"`,
      resourceId: instance.id, severity: "WARNING",
    });
    ResourceTracker.onDelete(req.params.projectId, "MEMORYSTORE", instance.id, instance.name).catch((err: unknown) =>
      logger.warn({ err }, "ResourceTracker.onDelete failed"),
    );
    res.json({ success: true, data: null });
  } catch (err) { next(err); }
});
