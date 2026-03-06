// apps/api/src/routes/vertexai.ts
import { Router } from "express";
import { CreateVertexModelSchema, CreateDataflowJobSchema } from "@pcg/shared";
import { prisma } from "../lib/prisma";
import { requireAuth, requireProjectAccess, requireProjectWrite, AuthenticatedRequest } from "../middleware/auth";
import { AppError } from "../middleware/errorHandler";
import { logActivity } from "../services/activityLog";
import { ResourceTracker } from "../services/resourceTracker";

export const vertexRouter = Router();
vertexRouter.use(requireAuth);

// ── Vertex AI Models ───────────────────────────────────────────────────────────
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
    const body = CreateVertexModelSchema.parse(req.body);
    const { user } = req as unknown as AuthenticatedRequest;
    const existing = await prisma.vertexModel.findFirst({ where: { projectId: req.params.projectId, name: body.name } });
    if (existing) throw new AppError(409, "CONFLICT", `Model "${body.name}" already exists`);
    const model = await prisma.vertexModel.create({
      data: { ...body, projectId: req.params.projectId, status: "UPLOADING", versionId: "1" },
      include: { endpoints: true },
    });
    setTimeout(async () => {
      await prisma.vertexModel.update({ where: { id: model.id }, data: { status: "DEPLOYED" } });
    }, 4000);
    await logActivity(prisma, req.params.projectId, user.email, { type: "VERTEX_MODEL_CREATE", description: `Uploaded Vertex AI model ${body.displayName}`, resourceId: model.id, severity: "INFO" });
    ResourceTracker.onCreate(req.params.projectId, "VERTEX_MODEL", r.id, body.name ?? r.id).catch(() => {});
    res.status(201).json({ success: true, data: model });
  } catch (err) { next(err); }
});

vertexRouter.delete("/:projectId/models/:modelId", requireProjectAccess, requireProjectWrite, async (req, res, next) => {
  try {
    const { user } = req as unknown as AuthenticatedRequest;
    const model = await prisma.vertexModel.findFirst({ where: { id: req.params.modelId, projectId: req.params.projectId } });
    if (!model) throw new AppError(404, "NOT_FOUND", "Model not found");
    await prisma.vertexModel.delete({ where: { id: model.id } });
    await logActivity(prisma, req.params.projectId, user.email, { type: "VERTEX_MODEL_DELETE", description: `Deleted Vertex AI model ${model.name}`, resourceId: model.id, severity: "WARNING" });
    ResourceTracker.onDelete(req.params.projectId, "VERTEX_MODEL", req.params.id ?? req.params.datasetId ?? "", "").catch(() => {});
    res.json({ success: true });
  } catch (err) { next(err); }
});

// ── Vertex AI Endpoints ────────────────────────────────────────────────────────
vertexRouter.post("/:projectId/models/:modelId/endpoints", requireProjectAccess, requireProjectWrite, async (req, res, next) => {
  try {
    const { user } = req as unknown as AuthenticatedRequest;
    const model = await prisma.vertexModel.findFirst({ where: { id: req.params.modelId, projectId: req.params.projectId } });
    if (!model) throw new AppError(404, "NOT_FOUND", "Model not found");
    const name = req.body.name || `${model.name}-endpoint`;
    const endpoint = await prisma.vertexEndpoint.create({
      data: { name, modelId: model.id, projectId: req.params.projectId, region: model.region, status: "DEPLOYING", hourlyCost: 0.1 },
    });
    setTimeout(async () => {
      await prisma.vertexEndpoint.update({ where: { id: endpoint.id }, data: { status: "DEPLOYED" } });
    }, 3000);
    await logActivity(prisma, req.params.projectId, user.email, { type: "VERTEX_ENDPOINT_CREATE", description: `Created endpoint ${name}`, resourceId: endpoint.id, severity: "INFO" });
    res.status(201).json({ success: true, data: endpoint });
  } catch (err) { next(err); }
});
