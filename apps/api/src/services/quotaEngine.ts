import { prisma } from "../lib/prisma";
import { AppError } from "../middleware/errorHandler";

// ── Default quota limits by resource type ─────────────────────────────────────
// Covers all major GCP service categories from the Developer's Cheat Sheet.
// These are sane per-project defaults; override via the ResourceQuota table.

const DEFAULT_QUOTAS: Record<string, number> = {
  // Compute (Cheat Sheet: Compute section)
  VM:                24,   // Compute Engine instances
  GKE_CLUSTER:        5,   // Kubernetes Engine clusters
  CLOUD_RUN:         20,   // Cloud Run services
  CLOUD_FUNCTION:    50,   // Cloud Functions
  APP_ENGINE:         5,   // App Engine versions

  // Storage (Cheat Sheet: Storage section)
  STORAGE_BUCKET:   100,   // Cloud Storage buckets
  FILESTORE:          5,   // Cloud Filestore instances

  // Database (Cheat Sheet: Database section)
  SQL_INSTANCE:      10,   // Cloud SQL instances (MySQL, PostgreSQL, SQL Server)
  BIGTABLE:           3,   // Cloud Bigtable clusters
  SPANNER:            3,   // Cloud Spanner instances
  FIRESTORE:          3,   // Cloud Firestore databases (Native + Datastore mode)
  MEMORYSTORE:        5,   // Memorystore (Redis + Memcached)

  // Data Analytics (Cheat Sheet: Data Analytics section)
  BIGQUERY_DATASET: 1000,  // BigQuery datasets
  PUBSUB_TOPIC:     100,   // Pub/Sub topics
  DATAFLOW_JOB:      25,   // Dataflow streaming/batch jobs
  DATAPROC:           5,   // Dataproc clusters (Managed Spark/Hadoop)
  CLOUD_COMPOSER:     3,   // Cloud Composer environments

  // AI/ML (Cheat Sheet: AI/ML section — Vertex AI)
  VERTEX_MODEL:      20,   // Vertex AI models
  VERTEX_ENDPOINT:   20,   // Vertex AI prediction endpoints
  VERTEX_TRAINING:   10,   // Vertex AI training jobs

  // Networking (Cheat Sheet: Networking section)
  VPC:               15,   // VPC networks (Virtual Private Cloud)
  LOAD_BALANCER:     50,   // Cloud Load Balancers
  DNS_ZONE:         100,   // Cloud DNS zones
  CDN:               20,   // Cloud CDN configs
  CLOUD_ARMOR:       10,   // Cloud Armor security policies
  NAT_GATEWAY:       10,   // Cloud NAT gateways
  FIREWALL_RULE:    100,   // VPC Firewall rules
  API_GATEWAY:       20,   // API Gateway configs

  // Security (Cheat Sheet: Identity and Security section)
  SECRET:           100,   // Secret Manager secrets
  KMS_KEY:           50,   // Cloud KMS keys
  SERVICE_ACCOUNT:  100,   // IAM Service accounts

  // DevOps CI/CD (Cheat Sheet: DevOps CI/CD section)
  BUILD_TRIGGER:     50,   // Cloud Build triggers
  ARTIFACT_REPO:     30,   // Artifact Registry repositories
  PIPELINE:          20,   // Cloud Deploy pipelines

  // Application Integration (Cheat Sheet: Application Integration section)
  SCHEDULER_JOB:    100,   // Cloud Scheduler jobs
  TASK_QUEUE:       100,   // Cloud Tasks queues
  WORKFLOW:          50,   // Cloud Workflows
  PUBSUB_SUBSCRIPTION: 200, // Pub/Sub subscriptions

  // Operations (Cheat Sheet: Operations & Monitoring section)
  MONITORING_ALERT:  50,   // Cloud Monitoring alert policies
  LOG_SINK:          50,   // Cloud Logging sinks

  // Billing (Cheat Sheet: Management Tools section)
  BUDGET:            10,   // Billing budgets
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
