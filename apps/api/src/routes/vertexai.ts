// apps/api/src/routes/vertexai.ts
import { Router } from "express";
import { CreateVertexModelSchema } from "@pcg/shared";
import { prisma }          from "../lib/prisma";
import { requireAuth, requireProjectAccess, requireProjectWrite, AuthenticatedRequest } from "../middleware/auth";
import { AppError }        from "../middleware/errorHandler";
import { logActivity }     from "../services/activityLog";
import { ResourceTracker } from "../services/resourceTracker";
import { logger }          from "../lib/logger";

export const vertexRouter = Router();
vertexRouter.use(requireAuth);

// ── Models ────────────────────────────────────────────────────────────────────

vertexRouter.get("/:projectId/models", requireProjectAccess, async (req, res, next) => {
  try {
    const models = await prisma.vertexModel.findMany({
      where: { projectId: req.params.projectId }, include: { endpoints: true }, orderBy: { createdAt: "desc" },
    });
    res.json({ success: true, data: models });
  } catch (err) { next(err); }
});

vertexRouter.post("/:projectId/models", requireProjectAccess, requireProjectWrite, async (req, res, next) => {
  try {
    const body     = CreateVertexModelSchema.parse(req.body);
    const { user } = req as unknown as AuthenticatedRequest;

    const existing = await prisma.vertexModel.findFirst({ where: { projectId: req.params.projectId, name: body.name } });
    if (existing) throw new AppError(409, "CONFLICT", `Model "${body.name}" already exists`);

    const model = await prisma.vertexModel.create({
      data: {
        projectId:    req.params.projectId,
        name:         body.name,
        displayName:  body.displayName,
        region:       body.region,
        framework:    body.framework,
        status:       "UPLOADING",
        versionId:    "1",
      },
      include: { endpoints: true },
    });

    setTimeout(async () => {
      try { await prisma.vertexModel.update({ where: { id: model.id }, data: { status: "DEPLOYED" } }); }
      catch (e) { logger.error({ err: e, modelId: model.id }, "Failed to transition Vertex model to DEPLOYED"); }
    }, 4_000);

    await logActivity(prisma, req.params.projectId, user.email, {
      type: "VERTEX_MODEL_CREATE", description: `Uploaded Vertex AI model "${body.displayName}"`,
      resourceId: model.id,
    });
    ResourceTracker.onCreate(req.params.projectId, "VERTEX_MODEL", model.id, model.name).catch((err: unknown) =>
      logger.warn({ err }, "ResourceTracker.onCreate failed"),
    );
    res.status(201).json({ success: true, data: model });
  } catch (err) { next(err); }
});

vertexRouter.delete("/:projectId/models/:modelId", requireProjectAccess, requireProjectWrite, async (req, res, next) => {
  try {
    const { user } = req as unknown as AuthenticatedRequest;
    const model    = await prisma.vertexModel.findFirst({ where: { id: req.params.modelId, projectId: req.params.projectId } });
    if (!model) throw new AppError(404, "NOT_FOUND", "Model not found");

    await prisma.vertexModel.delete({ where: { id: model.id } });
    await logActivity(prisma, req.params.projectId, user.email, {
      type: "VERTEX_MODEL_DELETE", description: `Deleted Vertex AI model "${model.name}"`,
      resourceId: model.id, severity: "WARNING",
    });
    ResourceTracker.onDelete(req.params.projectId, "VERTEX_MODEL", model.id, model.name).catch((err: unknown) =>
      logger.warn({ err }, "ResourceTracker.onDelete failed"),
    );
    res.json({ success: true, data: null });
  } catch (err) { next(err); }
});

// ── Endpoints ─────────────────────────────────────────────────────────────────

vertexRouter.post("/:projectId/models/:modelId/endpoints", requireProjectAccess, requireProjectWrite, async (req, res, next) => {
  try {
    const { user } = req as unknown as AuthenticatedRequest;
    const model    = await prisma.vertexModel.findFirst({ where: { id: req.params.modelId, projectId: req.params.projectId } });
    if (!model) throw new AppError(404, "NOT_FOUND", "Model not found");

    const name     = (req.body.name as string | undefined) || `${model.name}-endpoint`;
    const endpoint = await prisma.vertexEndpoint.create({
      data: {
        name,
        modelId:    model.id,
        projectId:  req.params.projectId,
        region:     model.region,
        status:     "DEPLOYING",
        hourlyCost: 0.1,
      },
    });

    setTimeout(async () => {
      try { await prisma.vertexEndpoint.update({ where: { id: endpoint.id }, data: { status: "DEPLOYED" } }); }
      catch (e) { logger.error({ err: e, endpointId: endpoint.id }, "Failed to transition Vertex endpoint to DEPLOYED"); }
    }, 3_000);

    await logActivity(prisma, req.params.projectId, user.email, {
      type: "VERTEX_ENDPOINT_CREATE", description: `Created endpoint "${name}" for model "${model.name}"`,
      resourceId: endpoint.id,
    });
    res.status(201).json({ success: true, data: endpoint });
  } catch (err) { next(err); }
});
