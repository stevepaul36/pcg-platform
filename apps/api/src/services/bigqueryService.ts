import { prisma } from "../lib/prisma";
import { logActivity } from "./activityLog";
import { AppError } from "../middleware/errorHandler";

export class BigQueryService {
  static async listDatasets(projectId: string) {
    return prisma.bQDataset.findMany({ where: { projectId }, include: { tables: true }, orderBy: { createdAt: "desc" } });
  }
  static async createDataset(projectId: string, data: any, userEmail: string) {
    const existing = await prisma.bQDataset.findFirst({ where: { projectId, name: data.name } });
    if (existing) throw new AppError(409, "CONFLICT", `Dataset "${data.name}" already exists`);
    const ds = await prisma.bQDataset.create({ data: { ...data, projectId }, include: { tables: true } });
    await logActivity(prisma, projectId, userEmail, { type: "BQ_DATASET_CREATE", description: `Created dataset ${data.name}`, resourceId: ds.id });
    return ds;
  }
  static async deleteDataset(projectId: string, datasetId: string, userEmail: string) {
    const ds = await prisma.bQDataset.findFirst({ where: { id: datasetId, projectId } });
    if (!ds) throw new AppError(404, "NOT_FOUND", "Dataset not found");
    await prisma.bQDataset.delete({ where: { id: datasetId } });
    await logActivity(prisma, projectId, userEmail, { type: "BQ_DATASET_DELETE", description: `Deleted dataset ${ds.name}`, resourceId: datasetId, severity: "WARNING" });
  }
  static async createTable(projectId: string, datasetId: string, data: any, userEmail: string) {
    const ds = await prisma.bQDataset.findFirst({ where: { id: datasetId, projectId } });
    if (!ds) throw new AppError(404, "NOT_FOUND", "Dataset not found");
    const tbl = await prisma.bQTable.create({ data: { ...data, datasetId } });
    await logActivity(prisma, projectId, userEmail, { type: "BQ_TABLE_CREATE", description: `Created table ${data.name} in ${ds.name}`, resourceId: tbl.id });
    return tbl;
  }
  static async deleteTable(projectId: string, tableId: string, userEmail: string) {
    const tbl = await prisma.bQTable.findUnique({ where: { id: tableId } });
    if (!tbl) throw new AppError(404, "NOT_FOUND", "Table not found");
    await prisma.bQTable.delete({ where: { id: tableId } });
    await logActivity(prisma, projectId, userEmail, { type: "BQ_TABLE_DELETE", description: `Deleted table ${tbl.name}`, resourceId: tableId, severity: "WARNING" });
  }
}
