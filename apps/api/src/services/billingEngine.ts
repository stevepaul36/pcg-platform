import { prisma } from "../lib/prisma";

const RESOURCE_COSTS: Record<string, number> = {
  VM: 0.05, GKE_CLUSTER: 0.10, CLOUD_RUN: 0.00024, CLOUD_FUNCTION: 0.0000025,
  SQL_INSTANCE: 0.07, MEMORYSTORE: 0.049, FIRESTORE: 0.006,
  STORAGE_BUCKET: 0.02, BIGQUERY: 0.005,
  DATAFLOW_JOB: 0.056, DATAPROC: 0.19,
  VERTEX_MODEL: 0.10, VERTEX_ENDPOINT: 0.10,
  LOAD_BALANCER: 0.025, VPC: 0, DNS_ZONE: 0.002,
  CDN: 0.008, API_GATEWAY: 0.003,
};

export class BillingEngine {
  static async trackUsage(projectId: string, resourceType: string, resourceId: string, resourceName: string, costPerHour?: number) {
    const cost = costPerHour ?? RESOURCE_COSTS[resourceType] ?? 0;
    return prisma.usageRecord.create({ data: {
      projectId, resourceType, resourceId, resourceName,
      costPerHour: cost, usageHours: 0, totalCost: 0, status: "ACTIVE",
    }});
  }

  static async stopUsage(resourceId: string) {
    const record = await prisma.usageRecord.findFirst({ where: { resourceId, status: "ACTIVE" } });
    if (!record) return;
    const hours = (Date.now() - record.periodStart.getTime()) / 3600000;
    await prisma.usageRecord.update({ where: { id: record.id }, data: {
      status: "STOPPED", periodEnd: new Date(), usageHours: hours,
      totalCost: hours * record.costPerHour,
    }});
  }

  static async getProjectCosts(projectId: string) {
    const records = await prisma.usageRecord.findMany({ where: { projectId }, orderBy: { periodStart: "desc" }, take: 200 });
    const now = Date.now();
    let totalCost = 0;
    const byType: Record<string, number> = {};
    for (const r of records) {
      const hours = r.status === "ACTIVE" ? (now - r.periodStart.getTime()) / 3600000 : r.usageHours;
      const cost = hours * r.costPerHour;
      totalCost += cost;
      byType[r.resourceType] = (byType[r.resourceType] ?? 0) + cost;
    }
    return { totalCost, byType, records };
  }

  static async getProjectCostSummary(projectId: string) {
    const { totalCost, byType } = await this.getProjectCosts(projectId);
    return {
      totalCost: Math.round(totalCost * 10000) / 10000,
      compute: Math.round((byType.VM ?? 0 + (byType.GKE_CLUSTER ?? 0) + (byType.CLOUD_RUN ?? 0) + (byType.CLOUD_FUNCTION ?? 0)) * 10000) / 10000,
      storage: Math.round(((byType.STORAGE_BUCKET ?? 0) + (byType.BIGQUERY ?? 0)) * 10000) / 10000,
      database: Math.round(((byType.SQL_INSTANCE ?? 0) + (byType.MEMORYSTORE ?? 0) + (byType.FIRESTORE ?? 0)) * 10000) / 10000,
      network: Math.round(((byType.LOAD_BALANCER ?? 0) + (byType.CDN ?? 0) + (byType.DNS_ZONE ?? 0)) * 10000) / 10000,
      ai: Math.round(((byType.VERTEX_MODEL ?? 0) + (byType.VERTEX_ENDPOINT ?? 0)) * 10000) / 10000,
      analytics: Math.round(((byType.DATAFLOW_JOB ?? 0) + (byType.DATAPROC ?? 0)) * 10000) / 10000,
    };
  }
}
