// apps/api/src/services/billingEngine.ts
// Approximate GCP hourly prices as of 2024 (us-central1 baseline).
// References: GCP Developer's Cheat Sheet service categories —
//   Compute, Storage, Database, Data Analytics, AI/ML, Networking,
//   DevOps CI/CD, Application Integration, Operations & Monitoring.

import { prisma } from "../lib/prisma";

// ── Default hourly cost by resource type ──────────────────────────────────────
// Used as a fallback when no override is provided on resource creation.
// Values derived from GCP public pricing pages (cloud.google.com/pricing).

export const RESOURCE_COSTS: Record<string, number> = {
  // ── Compute ──────────────────────────────────────────────────────────────
  VM:               0.0475,   // n1-standard-1 baseline
  GKE_CLUSTER:      0.10,     // cluster management fee + n1-standard-2 node
  CLOUD_RUN:        0.00024,  // 1 vCPU + 512 MB @ 0 min instances
  CLOUD_FUNCTION:   0.0000025,// per-invocation + GB-second; approx 1k/hr @ 256 MB
  APP_ENGINE:       0.05,     // Standard F1 instance class

  // ── Storage ───────────────────────────────────────────────────────────────
  STORAGE_BUCKET:   0.0000274, // $0.02/GB/mo standard → /730
  FILESTORE:        0.0003425, // $0.25/GB/mo HDD → /730

  // ── Database ──────────────────────────────────────────────────────────────
  SQL_INSTANCE:     0.0685,
  BIGTABLE:         0.65,     // 1 node SSD
  SPANNER:          0.90,     // 1 processing unit
  FIRESTORE:        0.006,    // requests+storage approximation
  MEMORYSTORE:      0.049,    // Redis BASIC M1 1 GB

  // ── Data Analytics ────────────────────────────────────────────────────────
  BIGQUERY:         0.005,
  DATAFLOW_JOB:     0.056,    // n1-standard-1 worker
  DATAPROC:         0.19,     // n1-standard-4 master + 2 workers
  CLOUD_COMPOSER:   0.35,     // small environment
  PUBSUB_TOPIC:     0.0001,   // ~1M msgs/hr

  // ── AI / ML ───────────────────────────────────────────────────────────────
  VERTEX_MODEL:     0.10,
  VERTEX_ENDPOINT:  0.10,     // n1-standard-4 equivalent
  VERTEX_TRAINING:  0.19,     // custom job n1-standard-4
  CLOUD_TPU:        12.88,    // v3-8 TPU

  // ── Networking ────────────────────────────────────────────────────────────
  LOAD_BALANCER:    0.025,
  VPC:              0.00,     // free; ingress/egress separately billed
  DNS_ZONE:         0.0014,   // ~1M queries/hr
  CDN:              0.0080,   // per-GB egress
  CLOUD_ARMOR:      0.0068,   // per policy + per rule
  NAT_GATEWAY:      0.045,

  // ── Identity & Security ───────────────────────────────────────────────────
  SECRET:           0.000082,  // per secret version + access ops
  KMS_KEY:          0.000137,  // per key version + crypto ops

  // ── DevOps / CI/CD ────────────────────────────────────────────────────────
  BUILD_TRIGGER:    0.003,
  ARTIFACT_REPO:    0.0001369, // $0.10/GB/mo
  PIPELINE:         0.03,

  // ── Operations & Monitoring ───────────────────────────────────────────────
  MONITORING_ALERT: 0.0000,   // first 5 alert policies free
  LOG_SINK:         0.0000,   // first 50 GiB/month free

  // ── Application Integration ───────────────────────────────────────────────
  SCHEDULER_JOB:    0.000137,
  TASK_QUEUE:       0.000137,
  WORKFLOW:         0.0001,
  API_GATEWAY:      0.003,
};

// ── Billing Engine ────────────────────────────────────────────────────────────

export class BillingEngine {
  /**
   * Begins tracking usage for a resource. Call on creation.
   * `costPerHour` overrides the default rate from RESOURCE_COSTS.
   */
  static async trackUsage(
    projectId:    string,
    resourceType: string,
    resourceId:   string,
    resourceName: string,
    costPerHour?: number,
  ) {
    const cost = costPerHour ?? RESOURCE_COSTS[resourceType] ?? 0;
    return prisma.usageRecord.create({
      data: {
        projectId, resourceType, resourceId, resourceName,
        costPerHour: cost, usageHours: 0, totalCost: 0, status: "ACTIVE",
      },
    });
  }

  /**
   * Stops tracking usage for a resource. Call on deletion.
   * Calculates final totalCost = usageHours × costPerHour.
   */
  static async stopUsage(resourceId: string) {
    const record = await prisma.usageRecord.findFirst({
      where: { resourceId, status: "ACTIVE" },
    });
    if (!record) return;

    const hours = (Date.now() - record.periodStart.getTime()) / 3_600_000;
    await prisma.usageRecord.update({
      where: { id: record.id },
      data: {
        status:     "STOPPED",
        periodEnd:  new Date(),
        usageHours: parseFloat(hours.toFixed(4)),
        totalCost:  parseFloat((hours * record.costPerHour).toFixed(8)),
      },
    });
  }

  /**
   * Returns all usage records and cost breakdown for a project.
   * Active records accrue cost based on elapsed wall-clock time.
   */
  static async getProjectCosts(projectId: string) {
    const records = await prisma.usageRecord.findMany({
      where: { projectId },
      orderBy: { periodStart: "desc" },
      take: 500,
    });

    const now = Date.now();
    let totalCost = 0;
    const byType: Record<string, number> = {};

    for (const r of records) {
      const hours = r.status === "ACTIVE"
        ? (now - r.periodStart.getTime()) / 3_600_000
        : r.usageHours;
      const cost = hours * r.costPerHour;
      totalCost += cost;
      byType[r.resourceType] = (byType[r.resourceType] ?? 0) + cost;
    }

    return { totalCost, byType, records };
  }

  /**
   * Returns a cost summary broken down by GCP service category.
   * Categories align with the GCP Developer's Cheat Sheet sections.
   */
  static async getProjectCostSummary(projectId: string) {
    const { totalCost, byType } = await this.getProjectCosts(projectId);

    const round = (n: number) => Math.round(n * 10_000) / 10_000;
    const sum   = (...types: string[]) =>
      types.reduce((acc, t) => acc + (byType[t] ?? 0), 0);

    return {
      totalCost:   round(totalCost),
      // Compute: Compute Engine, GKE, Cloud Run, Cloud Functions, App Engine
      compute:     round(sum("VM", "GKE_CLUSTER", "CLOUD_RUN", "CLOUD_FUNCTION", "APP_ENGINE")),
      // Storage: Cloud Storage, Cloud Filestore
      storage:     round(sum("STORAGE_BUCKET", "FILESTORE")),
      // Database: Cloud SQL, Bigtable, Spanner, Firestore, Memorystore
      database:    round(sum("SQL_INSTANCE", "BIGTABLE", "SPANNER", "FIRESTORE", "MEMORYSTORE")),
      // Networking: Load Balancing, CDN, Cloud Armor, DNS, NAT
      network:     round(sum("LOAD_BALANCER", "CDN", "CLOUD_ARMOR", "DNS_ZONE", "NAT_GATEWAY")),
      // AI/ML: Vertex AI models, endpoints, training, Cloud TPU
      ai:          round(sum("VERTEX_MODEL", "VERTEX_ENDPOINT", "VERTEX_TRAINING", "CLOUD_TPU")),
      // Analytics: BigQuery, Dataflow, Dataproc, Cloud Composer, Pub/Sub
      analytics:   round(sum("BIGQUERY", "DATAFLOW_JOB", "DATAPROC", "CLOUD_COMPOSER", "PUBSUB_TOPIC")),
      // DevOps: Cloud Build, Artifact Registry, Cloud Deploy
      devops:      round(sum("BUILD_TRIGGER", "ARTIFACT_REPO", "PIPELINE")),
      // Security: Secret Manager, Cloud KMS
      security:    round(sum("SECRET", "KMS_KEY")),
      // Integration: Scheduler, Tasks, Workflows, API Gateway
      integration: round(sum("SCHEDULER_JOB", "TASK_QUEUE", "WORKFLOW", "API_GATEWAY")),
    };
  }
}

