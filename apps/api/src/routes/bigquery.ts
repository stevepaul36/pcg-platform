// apps/api/src/routes/bigquery.ts
import { Router } from "express";
import { z } from "zod";
import { CreateBQDatasetSchema } from "@pcg/shared";
import { prisma } from "../lib/prisma";
import { requireAuth, requireProjectAccess, requireProjectWrite, AuthenticatedRequest } from "../middleware/auth";
import { AppError } from "../middleware/errorHandler";
import { logActivity } from "../services/activityLog";

export const bqRouter = Router();
bqRouter.use(requireAuth);

// GET /api/v1/bigquery/:projectId
bqRouter.get("/:projectId", requireProjectAccess, async (req, res, next) => {
  try {
    const datasets = await prisma.bQDataset.findMany({
      where: { projectId: req.params.projectId },
      include: { tables: true },
      orderBy: { createdAt: "desc" },
    });
    res.json({ success: true, data: datasets });
  } catch (err) { next(err); }
});

// POST /api/v1/bigquery/:projectId/datasets
bqRouter.post("/:projectId/datasets", requireProjectAccess, requireProjectWrite, async (req, res, next) => {
  try {
    const body = CreateBQDatasetSchema.parse(req.body);
    const { user } = req as unknown as AuthenticatedRequest;
    const existing = await prisma.bQDataset.findFirst({ where: { projectId: req.params.projectId, name: body.name } });
    if (existing) throw new AppError(409, "CONFLICT", `Dataset "${body.name}" already exists`);
    const dataset = await prisma.bQDataset.create({ data: { ...body, projectId: req.params.projectId }, include: { tables: true } });
    await logActivity(prisma, req.params.projectId, user.email, { type: "BIGQUERY_DATASET_CREATE", description: `Created BigQuery dataset ${body.name}`, resourceId: dataset.id, severity: "INFO" });
    res.status(201).json({ success: true, data: dataset });
  } catch (err) { next(err); }
});

// DELETE /api/v1/bigquery/:projectId/datasets/:datasetId
bqRouter.delete("/:projectId/datasets/:datasetId", requireProjectAccess, requireProjectWrite, async (req, res, next) => {
  try {
    const { user } = req as unknown as AuthenticatedRequest;
    const dataset = await prisma.bQDataset.findFirst({ where: { id: req.params.datasetId, projectId: req.params.projectId } });
    if (!dataset) throw new AppError(404, "NOT_FOUND", "Dataset not found");
    await prisma.bQDataset.delete({ where: { id: dataset.id } });
    await logActivity(prisma, req.params.projectId, user.email, { type: "BIGQUERY_DATASET_DELETE", description: `Deleted BigQuery dataset ${dataset.name}`, resourceId: dataset.id, severity: "WARNING" });
    res.json({ success: true });
  } catch (err) { next(err); }
});

// POST /api/v1/bigquery/:projectId/datasets/:datasetId/tables
const CreateTableSchema = z.object({
  name: z.string().min(1).max(1024).regex(/^[a-zA-Z0-9_]+$/),
  tableType: z.enum(["TABLE", "VIEW", "EXTERNAL"]).default("TABLE"),
  schema: z.array(z.any()).default([]),
});

bqRouter.post("/:projectId/datasets/:datasetId/tables", requireProjectAccess, requireProjectWrite, async (req, res, next) => {
  try {
    const body = CreateTableSchema.parse(req.body);
    const { user } = req as unknown as AuthenticatedRequest;
    const dataset = await prisma.bQDataset.findFirst({ where: { id: req.params.datasetId, projectId: req.params.projectId } });
    if (!dataset) throw new AppError(404, "NOT_FOUND", "Dataset not found");
    const table = await prisma.bQTable.create({ data: { ...body, datasetId: dataset.id } });
    await logActivity(prisma, req.params.projectId, user.email, { type: "BIGQUERY_TABLE_CREATE", description: `Created table ${body.name} in dataset ${dataset.name}`, resourceId: table.id, severity: "INFO" });
    res.status(201).json({ success: true, data: table });
  } catch (err) { next(err); }
});

// DELETE /api/v1/bigquery/:projectId/tables/:tableId
bqRouter.delete("/:projectId/tables/:tableId", requireProjectAccess, requireProjectWrite, async (req, res, next) => {
  try {
    const { user } = req as unknown as AuthenticatedRequest;
    const table = await prisma.bQTable.findUnique({ where: { id: req.params.tableId } });
    if (!table) throw new AppError(404, "NOT_FOUND", "Table not found");
    await prisma.bQTable.delete({ where: { id: table.id } });
    await logActivity(prisma, req.params.projectId, user.email, { type: "BIGQUERY_TABLE_DELETE", description: `Deleted table ${table.name}`, resourceId: table.id, severity: "WARNING" });
    res.json({ success: true });
  } catch (err) { next(err); }
});
