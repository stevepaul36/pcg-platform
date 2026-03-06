import { prisma } from "../lib/prisma";
import { AppError } from "../middleware/errorHandler";

const DEFAULT_QUOTAS: Record<string, number> = {
  VM: 24, GKE_CLUSTER: 5, CLOUD_RUN: 20, CLOUD_FUNCTION: 50,
  STORAGE_BUCKET: 100, SQL_INSTANCE: 10, MEMORYSTORE: 5, FIRESTORE: 3,
  BIGQUERY_DATASET: 1000, PUBSUB_TOPIC: 100, DATAFLOW_JOB: 25, DATAPROC: 5,
  VERTEX_MODEL: 20, VPC: 15, LOAD_BALANCER: 50, DNS_ZONE: 100,
  API_GATEWAY: 20, CDN: 20, FIREWALL_RULE: 100, CLOUD_ARMOR: 10,
  BUILD_TRIGGER: 50, ARTIFACT_REPO: 30, SCHEDULER_JOB: 100,
  TASK_QUEUE: 100, SERVICE_ACCOUNT: 100, SECRET: 100, BUDGET: 10,
  WORKFLOW: 50, PIPELINE: 20,
};

export class QuotaEngine {
  static async checkQuota(projectId: string, resourceType: string, region = "global") {
    let quota = await prisma.resourceQuota.findUnique({
      where: { projectId_resourceType_region: { projectId, resourceType, region } },
    });
    if (!quota) {
      quota = await prisma.resourceQuota.create({ data: {
        projectId, resourceType, region,
        limitValue: DEFAULT_QUOTAS[resourceType] ?? 100, currentUsage: 0,
      }});
    }
    if (quota.currentUsage >= quota.limitValue) {
      throw new AppError(429, "QUOTA_EXCEEDED", `Quota exceeded for ${resourceType}: ${quota.currentUsage}/${quota.limitValue} in ${region}`);
    }
    return quota;
  }

  static async incrementUsage(projectId: string, resourceType: string, region = "global") {
    await this.checkQuota(projectId, resourceType, region);
    return prisma.resourceQuota.update({
      where: { projectId_resourceType_region: { projectId, resourceType, region } },
      data: { currentUsage: { increment: 1 } },
    });
  }

  static async decrementUsage(projectId: string, resourceType: string, region = "global") {
    const quota = await prisma.resourceQuota.findUnique({
      where: { projectId_resourceType_region: { projectId, resourceType, region } },
    });
    if (quota && quota.currentUsage > 0) {
      await prisma.resourceQuota.update({
        where: { id: quota.id }, data: { currentUsage: { decrement: 1 } },
      });
    }
  }

  static async getProjectQuotas(projectId: string) {
    const quotas = await prisma.resourceQuota.findMany({ where: { projectId }, orderBy: { resourceType: "asc" } });
    // Fill in defaults for any not yet created
    const existing = new Set(quotas.map(q => `${q.resourceType}:${q.region}`));
    const all = [...quotas];
    for (const [type, limit] of Object.entries(DEFAULT_QUOTAS)) {
      if (!existing.has(`${type}:global`)) {
        all.push({ id: "", projectId, resourceType: type, limitValue: limit, currentUsage: 0, region: "global" });
      }
    }
    return all.sort((a, b) => a.resourceType.localeCompare(b.resourceType));
  }
}
