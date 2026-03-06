// packages/shared/src/index.ts
// ─── All shared types, constants, and Zod schemas ────────────────────────────

import { z } from "zod";

// ── Resource status types ─────────────────────────────────────────────────────

export type VMStatus =
  | "PROVISIONING" | "RUNNING" | "STOPPING"
  | "STOPPED" | "SUSPENDED" | "TERMINATED" | "FAILED";

export type SQLStatus        = "PENDING_CREATE" | "RUNNABLE" | "STOPPED" | "FAILED";
export type EventSeverity    = "INFO" | "WARNING" | "ERROR";
export type Plan             = "free" | "student" | "personal";
export type AnnouncementType = "info" | "warning" | "feature" | "maintenance";
export type ImprovementStatus   = "planned" | "in_progress" | "completed" | "cancelled";
export type ImprovementPriority = "low" | "medium" | "high" | "critical";
export type ImprovementCategory = "feature" | "bug" | "performance" | "ux";

// ── Domain models (mirror Prisma schema) ──────────────────────────────────────

export interface User {
  id:              string;
  email:           string;
  name:            string;
  plan:            Plan;
  subscriptionEnd: string | null;
  createdAt:       string;
}

export interface Project {
  id:            string;
  name:          string;
  displayName:   string;
  ownerId:       string;
  totalSpendUSD: number;
  createdAt:     string;
}

export interface VMInstance {
  id:             string;
  projectId:      string;
  name:           string;
  zone:           string;
  region:         string;
  machineType:    string;
  vcpus:          number;
  ramGb:          number;
  diskGb:         number;
  diskType:       "pd-standard" | "pd-balanced" | "pd-ssd";
  osImage:        string;
  preemptible:    boolean;
  tags:           string[];
  internalIp:     string;
  externalIp:     string;
  status:         VMStatus;
  hourlyCost:     number;
  diskHourlyCost: number;
  cpuUsage:       number;
  ramUsage:       number;
  netIn:          number;
  netOut:         number;
  uptimeSec:      number;
  cpuHistory:     number[];
  ramHistory:     number[];
  createdAt:      string;
  updatedAt:      string;
}

export interface StorageBucket {
  id:             string;
  projectId:      string;
  name:           string;
  location:       string;
  storageClass:   "Standard" | "Nearline" | "Coldline" | "Archive";
  versioning:     boolean;
  totalSizeBytes: number;
  objects:        StorageObject[];
  createdAt:      string;
}

export interface StorageObject {
  id:          string;
  bucketId:    string;
  name:        string;
  sizeBytes:   number;
  contentType: string;
  etag:        string;
  generation:  string;
  uploadedAt:  string;
}

export interface SQLInstance {
  id:               string;
  projectId:        string;
  name:             string;
  dbType:           "PostgreSQL" | "MySQL" | "SQL Server";
  dbVersion:        string;
  tier:             string;
  region:           string;
  storageGb:        number;
  highAvailability: boolean;
  backups:          boolean;
  status:           SQLStatus;
  privateIp:        string;
  connectionName:   string;
  hourlyCost:       number;
  createdAt:        string;
}

export interface IAMMember {
  id:        string;
  projectId: string;
  email:     string;
  role:      string;
  type:      "user" | "serviceAccount" | "group";
  addedAt:   string;
  addedBy:   string;
}

export interface ActivityLogEntry {
  id:          string;
  projectId:   string;
  type:        string;
  description: string;
  resourceId:  string | null;
  severity:    EventSeverity;
  user:        string;
  metadata:    Record<string, unknown>;
  timestamp:   string;
}

export interface Announcement {
  id:          string;
  title:       string;
  body:        string;
  type:        AnnouncementType;
  pinned:      boolean;
  publishedAt: string;
  expiresAt:   string | null;
  authorEmail: string;
}

export interface Improvement {
  id:          string;
  title:       string;
  description: string;
  status:      ImprovementStatus;
  priority:    ImprovementPriority;
  category:    ImprovementCategory;
  votes:       number;
  authorEmail: string;
  createdAt:   string;
  completedAt: string | null;
}

export interface PlanQuota {
  // Compute
  maxVMs:            number;
  maxGKEClusters:    number;
  maxCloudRunServices: number;
  maxCloudFunctions: number;
  // Storage & Database
  maxBuckets:        number;
  maxSQLInstances:   number;
  maxMemorystoreInstances: number;
  // Analytics
  maxBQDatasets:     number;
  maxPubSubTopics:   number;
  // Networking
  maxVPCs:           number;
  maxLoadBalancers:  number;
  // Security
  maxSecrets:        number;
  maxServiceAccounts: number;
  // Session
  sessionDays:       number;
  label:             string;
}

// ── Pagination ────────────────────────────────────────────────────────────────

export interface PaginatedMeta {
  hasNextPage: boolean;
  nextCursor:  string | null;
}

export interface PaginatedResponse<T> {
  success: true;
  data:    T[];
  meta:    PaginatedMeta;
}

// ── Catalogs (shared between API validation and frontend dropdowns) ───────────
// All machine families referenced in the GCP Developer's Cheat Sheet:
// Compute Engine — VMs, GPUs, TPUs; Preemptible VMs; Shielded VMs; Sole-tenant Nodes

export const MACHINE_TYPES = [
  // E2 — Cost-optimised
  "e2-micro", "e2-small", "e2-medium",
  "e2-standard-2", "e2-standard-4", "e2-standard-8", "e2-standard-16",
  "e2-highcpu-2", "e2-highcpu-8", "e2-highmem-2", "e2-highmem-8",
  // N1 — General-purpose (Skylake)
  "n1-standard-1", "n1-standard-2", "n1-standard-4",
  "n1-standard-8", "n1-standard-16", "n1-standard-32",
  "n1-highcpu-4", "n1-highcpu-8",
  "n1-highmem-4", "n1-highmem-8",
  // N2 — Balanced (Intel Cascade Lake)
  "n2-standard-2", "n2-standard-4", "n2-standard-8",
  "n2-standard-16", "n2-standard-32",
  "n2-highcpu-4", "n2-highcpu-8",
  "n2-highmem-4", "n2-highmem-8",
  // N2D — Balanced (AMD EPYC)
  "n2d-standard-2", "n2d-standard-4", "n2d-standard-8",
  "n2d-highcpu-4", "n2d-highmem-4",
  // T2D — Scale-out (AMD EPYC Milan)
  "t2d-standard-1", "t2d-standard-4", "t2d-standard-8",
  // C2 — Compute-optimised (Intel Cascade Lake)
  "c2-standard-4", "c2-standard-8", "c2-standard-16",
  "c2-standard-30", "c2-standard-60",
  // C3 — General-purpose (Intel Sapphire Rapids)
  "c3-standard-4", "c3-standard-8", "c3-standard-22",
  "c3-highcpu-4", "c3-highmem-4",
  // M1 — Memory-optimised
  "m1-ultramem-40", "m1-ultramem-80", "m1-megamem-96",
  // A2 — Accelerator-optimised (NVIDIA A100 GPU)
  "a2-highgpu-1g", "a2-highgpu-2g", "a2-highgpu-4g", "a2-highgpu-8g",
] as const;

// All GCP regions as listed in cloud.google.com/about/locations
export const REGIONS = [
  // North America
  "us-central1", "us-east1", "us-east4", "us-east5", "us-south1",
  "us-west1", "us-west2", "us-west3", "us-west4",
  "northamerica-northeast1", "northamerica-northeast2",
  // South America
  "southamerica-east1", "southamerica-west1",
  // Europe
  "europe-central2", "europe-north1", "europe-southwest1",
  "europe-west1", "europe-west2", "europe-west3", "europe-west4",
  "europe-west6", "europe-west8", "europe-west9", "europe-west10", "europe-west12",
  // Middle East
  "me-central1", "me-west1",
  // Africa
  "africa-south1",
  // Asia Pacific
  "asia-east1", "asia-east2",
  "asia-northeast1", "asia-northeast2", "asia-northeast3",
  "asia-south1", "asia-south2",
  "asia-southeast1", "asia-southeast2",
  "australia-southeast1", "australia-southeast2",
] as const;

export const ZONES = [
  "us-central1-a", "us-central1-b", "us-central1-c", "us-central1-f",
  "us-east1-b", "us-east1-c", "us-east1-d",
  "us-east4-a", "us-east4-b", "us-east4-c",
  "us-west1-a", "us-west1-b", "us-west1-c",
  "us-west2-a", "us-west2-b", "us-west2-c",
  "us-west4-a", "us-west4-b",
  "northamerica-northeast1-a", "northamerica-northeast1-b",
  "europe-west1-b", "europe-west1-c", "europe-west1-d",
  "europe-west2-a", "europe-west2-b", "europe-west2-c",
  "europe-west3-a", "europe-west3-b", "europe-west3-c",
  "europe-west4-a", "europe-west4-b",
  "europe-west6-a", "europe-west6-b",
  "asia-south1-a", "asia-south1-b", "asia-south1-c",
  "asia-east1-a", "asia-east1-b", "asia-east1-c",
  "asia-east2-a", "asia-east2-b",
  "asia-northeast1-a", "asia-northeast1-b", "asia-northeast1-c",
  "asia-southeast1-a", "asia-southeast1-b", "asia-southeast1-c",
  "australia-southeast1-a", "australia-southeast1-b", "australia-southeast1-c",
] as const;

export const OS_IMAGES = [
  // Debian (Google-maintained)
  "debian-11", "debian-12",
  // Ubuntu LTS
  "ubuntu-2004-lts", "ubuntu-2204-lts", "ubuntu-2404-lts",
  // Enterprise Linux
  "centos-stream-9", "rocky-linux-9", "rhel-9",
  // Container-optimised
  "cos-stable", "cos-dev",
  // Windows Server
  "windows-server-2019", "windows-server-2022",
  // Deep Learning VM (references Vertex AI Deep Learning VM Images from cheat sheet)
  "deep-learning-vm-pytorch", "deep-learning-vm-tensorflow",
] as const;

export const SQL_TIERS = [
  // Shared-core (dev/test)
  "db-f1-micro", "db-g1-small",
  // Standard — N1
  "db-n1-standard-1", "db-n1-standard-2", "db-n1-standard-4", "db-n1-standard-8",
  // High-memory — N1
  "db-n1-highmem-2", "db-n1-highmem-4", "db-n1-highmem-8",
  // Enterprise (PostgreSQL 15+, MySQL 8.0+)
  "db-perf-optimized-N-2", "db-perf-optimized-N-4", "db-perf-optimized-N-8",
] as const;

export const DB_VERSIONS: Record<string, string[]> = {
  "PostgreSQL":  ["POSTGRES_13", "POSTGRES_14", "POSTGRES_15", "POSTGRES_16"],
  "MySQL":       ["MYSQL_5_7", "MYSQL_8_0", "MYSQL_8_4"],
  "SQL Server":  [
    "SQLSERVER_2017_STANDARD", "SQLSERVER_2017_ENTERPRISE",
    "SQLSERVER_2019_STANDARD", "SQLSERVER_2019_ENTERPRISE",
    "SQLSERVER_2022_STANDARD", "SQLSERVER_2022_ENTERPRISE",
  ],
};

// ── Zod validation schemas ────────────────────────────────────────────────────

export const CreateVMSchema = z.object({
  name:        z.string().regex(/^[a-z][a-z0-9-]{0,61}[a-z0-9]$/, "Invalid VM name"),
  zone:        z.enum(ZONES),
  region:      z.enum(REGIONS),
  machineType: z.enum(MACHINE_TYPES),
  diskGb:      z.number().int().min(10).max(65536),
  diskType:    z.enum([
    "pd-standard", "pd-balanced", "pd-ssd", "pd-extreme",
    "hyperdisk-balanced", "hyperdisk-extreme",
  ]),
  osImage:     z.enum(OS_IMAGES),
  preemptible: z.boolean().default(false),
  tags:        z.array(z.string().max(63)).max(64).default([]),
}).refine(d => d.zone.startsWith(d.region + "-"), {
  message: "Zone must belong to the specified region",
  path: ["zone"],
});

export const CreateBucketSchema = z.object({
  name:         z.string().regex(/^[a-z0-9][a-z0-9\-_.]{1,220}[a-z0-9]$/, "Invalid bucket name"),
  location:     z.enum(REGIONS),
  storageClass: z.enum(["Standard", "Nearline", "Coldline", "Archive"]),
  versioning:   z.boolean().default(false),
});

export const CreateSQLSchema = z.object({
  name:             z.string().regex(/^[a-z][a-z0-9-]{0,62}$/, "Invalid instance name"),
  dbType:           z.enum(["PostgreSQL", "MySQL", "SQL Server"]),
  dbVersion:        z.string().min(1),
  tier:             z.enum(SQL_TIERS),
  region:           z.enum(REGIONS),
  storageGb:        z.number().int().min(10).max(65536),
  highAvailability: z.boolean().default(false),
  backups:          z.boolean().default(true),
}).refine(d => DB_VERSIONS[d.dbType]?.includes(d.dbVersion), {
  message: "Invalid database version for the selected database type",
  path: ["dbVersion"],
});

export const AddIAMMemberSchema = z.object({
  email: z.string().email(),
  role:  z.enum(["Viewer", "Editor", "Owner"]),
  type:  z.enum(["user", "serviceAccount", "group"]),
});

export const CreateAnnouncementSchema = z.object({
  title:     z.string().min(3).max(120),
  body:      z.string().min(10).max(4000),
  type:      z.enum(["info", "warning", "feature", "maintenance"]).default("info"),
  pinned:    z.boolean().default(false),
  expiresAt: z.string().datetime().optional(),
});

export const CreateImprovementSchema = z.object({
  title:       z.string().min(5).max(120),
  description: z.string().min(10).max(2000),
  priority:    z.enum(["low", "medium", "high", "critical"]).default("medium"),
  category:    z.enum(["feature", "bug", "performance", "ux"]).default("feature"),
});

export type CreateVMInput           = z.infer<typeof CreateVMSchema>;
export type CreateBucketInput       = z.infer<typeof CreateBucketSchema>;
export type CreateSQLInput          = z.infer<typeof CreateSQLSchema>;
export type AddIAMMemberInput       = z.infer<typeof AddIAMMemberSchema>;
export type CreateAnnouncementInput = z.infer<typeof CreateAnnouncementSchema>;
export type CreateImprovementInput  = z.infer<typeof CreateImprovementSchema>;

// ── API response envelope ─────────────────────────────────────────────────────

export interface ApiResponse<T> {
  success: boolean;
  data?:   T;
  error?:  { code: string; message: string; details?: unknown };
  meta?:   { requestId: string; timestamp: string; hasNextPage?: boolean; nextCursor?: string | null };
}

// ── BigQuery ───────────────────────────────────────────────────────────────────
export interface BQDataset {
  id: string; projectId: string; name: string;
  location: string; description: string;
  tables: BQTable[]; createdAt: string;
}
export interface BQTable {
  id: string; datasetId: string; name: string;
  schema: any[]; rowCount: number; sizeBytes: number;
  tableType: "TABLE" | "VIEW" | "EXTERNAL"; createdAt: string;
}

// ── Pub/Sub ────────────────────────────────────────────────────────────────────
export interface PubSubTopic {
  id: string; projectId: string; name: string;
  messageCount: number; createdAt: string;
  subscriptions: PubSubSubscription[];
}
export interface PubSubSubscription {
  id: string; topicId: string; projectId: string;
  name: string; ackDeadline: number; messageCount: number; createdAt: string;
}

// ── Cloud Functions ────────────────────────────────────────────────────────────
export interface CloudFunction {
  id: string; projectId: string; name: string;
  runtime: string; region: string; entryPoint: string;
  trigger: "HTTP" | "PUBSUB" | "STORAGE";
  status: "ACTIVE" | "DEPLOYING" | "OFFLINE" | "FAILED";
  invocations: number; avgDurationMs: number;
  memoryMb: number; timeoutSec: number; hourlyCost: number;
  createdAt: string; updatedAt: string;
}

// ── GKE ────────────────────────────────────────────────────────────────────────
export interface GKECluster {
  id: string; projectId: string; name: string;
  zone: string; version: string; nodeCount: number;
  machineType: string; diskGb: number;
  status: "PROVISIONING" | "RUNNING" | "RECONCILING" | "STOPPING" | "ERROR";
  endpoint: string; hourlyCost: number;
  createdAt: string; updatedAt: string;
}

// ── Cloud Run ──────────────────────────────────────────────────────────────────
export interface CloudRunService {
  id: string; projectId: string; name: string;
  region: string; image: string; cpu: string;
  memoryMb: number; minInstances: number; maxInstances: number;
  status: "DEPLOYING" | "ACTIVE" | "FAILED";
  url: string; requestCount: number; hourlyCost: number;
  createdAt: string; updatedAt: string;
}

// ── Networking ─────────────────────────────────────────────────────────────────
export interface VPCNetwork {
  id: string; projectId: string; name: string;
  subnet: string; region: string; mode: "AUTO" | "CUSTOM"; createdAt: string;
}
export interface LoadBalancer {
  id: string; projectId: string; name: string;
  type: "HTTP" | "HTTPS" | "TCP" | "UDP";
  region: string; ip: string; backends: number;
  status: "ACTIVE" | "CREATING" | "FAILED";
  hourlyCost: number; createdAt: string;
}
export interface CloudDNSZone {
  id: string; projectId: string; name: string;
  dnsName: string; visibility: "public" | "private";
  recordCount: number; createdAt: string;
}

// ── Secret Manager ─────────────────────────────────────────────────────────────
export interface SecretManagerSecret {
  id: string; projectId: string; name: string;
  replication: string; versions: number;
  createdAt: string; updatedAt: string;
}

// ── Cloud KMS ──────────────────────────────────────────────────────────────────
export interface KMSKeyRing {
  id: string; projectId: string; name: string;
  location: string; createdAt: string; keys: KMSKey[];
}
export interface KMSKey {
  id: string; keyRingId: string; name: string;
  purpose: string; algorithm: string;
  rotationDays: number; state: "ENABLED" | "DISABLED" | "DESTROYED";
  createdAt: string;
}

// ── Vertex AI ──────────────────────────────────────────────────────────────────
export interface VertexModel {
  id: string; projectId: string; name: string;
  displayName: string; framework: string;
  region: string; status: "UPLOADING" | "DEPLOYED" | "FAILED";
  versionId: string; createdAt: string;
  endpoints: VertexEndpoint[];
}
export interface VertexEndpoint {
  id: string; projectId: string; modelId: string; name: string;
  region: string; status: "DEPLOYING" | "DEPLOYED" | "FAILED";
  requestCount: number; hourlyCost: number; createdAt: string;
}

// ── Dataflow ───────────────────────────────────────────────────────────────────
export interface DataflowJob {
  id: string; projectId: string; name: string;
  template: string; region: string;
  status: "JOB_STATE_RUNNING" | "JOB_STATE_DONE" | "JOB_STATE_FAILED" | "JOB_STATE_CANCELLED";
  workers: number; maxWorkers: number;
  bytesProcessed: number; hourlyCost: number;
  startedAt: string; updatedAt: string;
}

// ── Zod Schemas for new resources ─────────────────────────────────────────────
export const CreateBQDatasetSchema = z.object({
  name: z.string().min(1).max(60).regex(/^[a-zA-Z0-9_]+$/),
  location: z.enum(["US", "EU", "us-central1", "europe-west1", "asia-east1"]).default("US"),
  description: z.string().max(16384).default(""),
});

export const CreatePubSubTopicSchema = z.object({
  name: z.string().min(1).max(255).regex(/^[a-zA-Z][a-zA-Z0-9\-_.~+%]+$/),
});

export const CreateFunctionSchema = z.object({
  name: z.string().min(1).max(63).regex(/^[a-z][a-z0-9-]+$/),
  // Cloud Functions supported runtimes (as of 2024 — GCP Cheat Sheet: Cloud Functions)
  runtime: z.enum([
    // Node.js
    "nodejs18", "nodejs20", "nodejs22",
    // Python
    "python310", "python311", "python312",
    // Go
    "go120", "go121", "go122",
    // Java
    "java17", "java21",
    // Ruby
    "ruby32",
    // .NET
    "dotnet6", "dotnet8",
    // PHP
    "php82",
  ]),
  region: z.string().min(1),
  entryPoint: z.string().min(1),
  trigger: z.enum(["HTTP", "PUBSUB", "STORAGE", "EVENTARC"]),
  memoryMb: z.number().int().min(128).max(32768).default(256),
  timeoutSec: z.number().int().min(1).max(3600).default(60), // 2nd gen supports up to 3600s
  concurrency: z.number().int().min(1).max(1000).default(1),  // 2nd gen concurrency
});

export const CreateGKEClusterSchema = z.object({
  name: z.string().min(1).max(40).regex(/^[a-z][a-z0-9-]+$/),
  zone: z.string().min(1),
  nodeCount: z.number().int().min(1).max(1000).default(3),
  machineType: z.enum(MACHINE_TYPES),
  diskGb: z.number().int().min(10).max(2000).default(100),
  // GKE channel / version (Cheat Sheet: Kubernetes Engine — Managed Kubernetes)
  version: z.string().default("1.30"),
  autopilot: z.boolean().default(false),
});

export const CreateCloudRunSchema = z.object({
  name: z.string().min(1).max(63).regex(/^[a-z][a-z0-9-]+$/),
  region: z.string().min(1),
  image: z.string().min(1),
  cpu: z.enum(["1", "2", "4", "8"]).default("1"),
  memoryMb: z.number().int().min(128).max(32768).default(512),
  minInstances: z.number().int().min(0).max(1000).default(0),
  maxInstances: z.number().int().min(1).max(1000).default(100),
});

export const CreateVPCSchema = z.object({
  name: z.string().min(1).max(63).regex(/^[a-z][a-z0-9-]+$/),
  subnet: z.string().min(1),
  region: z.string().min(1),
  mode: z.enum(["AUTO", "CUSTOM"]).default("AUTO"),
});

export const CreateLoadBalancerSchema = z.object({
  name: z.string().min(1).max(63).regex(/^[a-z][a-z0-9-]+$/),
  type: z.enum(["HTTP", "HTTPS", "TCP", "UDP"]),
  region: z.string().default("global"),
  backends: z.number().int().min(1).max(100).default(1),
});

export const CreateDNSZoneSchema = z.object({
  name: z.string().min(1).max(63).regex(/^[a-z][a-z0-9-]+$/),
  dnsName: z.string().min(1),
  visibility: z.enum(["public", "private"]).default("public"),
});

export const CreateSecretSchema = z.object({
  name: z.string().min(1).max(255).regex(/^[a-zA-Z0-9_-]+$/),
  replication: z.enum(["automatic", "user-managed"]).default("automatic"),
});

export const CreateKMSKeyRingSchema = z.object({
  name: z.string().min(1).max(63).regex(/^[a-zA-Z0-9_-]+$/),
  location: z.enum(["global", "us-central1", "europe-west1", "asia-east1"]).default("global"),
});

export const CreateKMSKeySchema = z.object({
  name: z.string().min(1).max(63).regex(/^[a-zA-Z0-9_-]+$/),
  purpose: z.enum(["ENCRYPT_DECRYPT", "SIGN_VERIFY", "ASYMMETRIC_DECRYPT"]).default("ENCRYPT_DECRYPT"),
  algorithm: z.string().default("GOOGLE_SYMMETRIC_ENCRYPTION"),
  rotationDays: z.number().int().min(1).max(3650).default(90),
});

export const CreateVertexModelSchema = z.object({
  name: z.string().min(1).max(128).regex(/^[a-zA-Z0-9_-]+$/),
  displayName: z.string().min(1).max(128),
  framework: z.enum(["TensorFlow", "PyTorch", "scikit-learn", "XGBoost"]),
  region: z.string().default("us-central1"),
});

export const CreateDataflowJobSchema = z.object({
  name: z.string().min(1).max(128).regex(/^[a-z][a-z0-9-]+$/),
  template: z.string().min(1),
  region: z.string().min(1),
  workers: z.number().int().min(1).max(1000).default(1),
  maxWorkers: z.number().int().min(1).max(1000).default(10),
});

// ── Cloud Monitoring ──────────────────────────────────────────────────────────
export interface MonitoringAlertPolicy { id: string; projectId: string; name: string; displayName: string; conditionType: string; metricType: string; threshold: number; duration: string; enabled: boolean; notifyEmails: string[]; createdAt: string; }
export interface UptimeCheck { id: string; projectId: string; displayName: string; monitoredUrl: string; checkInterval: string; timeout: string; regions: string[]; status: string; lastCheckAt: string | null; lastStatus: string; createdAt: string; }
export const CreateAlertPolicySchema = z.object({ name: z.string().min(1).max(60).regex(/^[a-z][a-z0-9_-]*$/), displayName: z.string().min(1).max(128), conditionType: z.enum(["METRIC_THRESHOLD","METRIC_ABSENCE","UPTIME_CHECK"]), metricType: z.string().min(1), threshold: z.number().min(0).max(1).default(0.8), duration: z.enum(["60s","120s","300s","600s"]).default("60s"), notifyEmails: z.array(z.string().email()).default([]) });
export const CreateUptimeCheckSchema = z.object({ displayName: z.string().min(1).max(128), monitoredUrl: z.string().url(), checkInterval: z.enum(["60s","300s","600s","900s"]).default("60s"), timeout: z.enum(["10s","30s","60s"]).default("10s"), regions: z.array(z.enum(["USA","EUROPE","SOUTH_AMERICA","ASIA_PACIFIC"])).default(["USA"]) });

// ── Cloud Build ───────────────────────────────────────────────────────────────
export interface CloudBuildTrigger { id: string; projectId: string; name: string; description: string; repoSource: string; branchPattern: string; buildSteps: string[]; status: string; lastBuildAt: string | null; lastBuildStatus: string; createdAt: string; }
export const CreateBuildTriggerSchema = z.object({ name: z.string().min(1).max(60).regex(/^[a-z][a-z0-9_-]*$/), description: z.string().max(256).default(""), repoSource: z.string().min(1), branchPattern: z.string().default("^main$"), buildSteps: z.array(z.string()).min(1).max(10) });

// ── Artifact Registry ─────────────────────────────────────────────────────────
export interface ArtifactRepo { id: string; projectId: string; name: string; format: string; location: string; description: string; sizeBytes: string; packageCount: number; cleanupPolicy: string; createdAt: string; }
export const CreateArtifactRepoSchema = z.object({ name: z.string().min(1).max(60).regex(/^[a-z][a-z0-9_-]*$/), format: z.enum(["DOCKER","NPM","PYTHON","MAVEN","APT","GO"]), location: z.enum(["us-central1","us-east1","europe-west1","asia-east1"]), description: z.string().max(256).default("") });

// ── Cloud Scheduler ───────────────────────────────────────────────────────────
export interface SchedulerJob { id: string; projectId: string; name: string; description: string; schedule: string; timezone: string; targetType: string; targetUri: string; httpMethod: string; status: string; lastRunAt: string | null; lastRunStatus: string; retryCount: number; createdAt: string; }
export const CreateSchedulerJobSchema = z.object({ name: z.string().min(1).max(60).regex(/^[a-z][a-z0-9_-]*$/), description: z.string().max(256).default(""), schedule: z.string().min(1).regex(/^[0-9*\/,\- ]+$/), timezone: z.string().default("UTC"), targetType: z.enum(["HTTP","PUBSUB","APP_ENGINE"]), targetUri: z.string().min(1), httpMethod: z.enum(["GET","POST","PUT","DELETE","PATCH"]).default("POST") });

// ── API Gateway ───────────────────────────────────────────────────────────────
export interface ApiGatewayConfig { id: string; projectId: string; name: string; displayName: string; backendUrl: string; region: string; protocol: string; authType: string; rateLimitRpm: number; status: string; requestCount: string; gatewayUrl: string; createdAt: string; }
export const CreateApiGatewaySchema = z.object({ name: z.string().min(1).max(60).regex(/^[a-z][a-z0-9_-]*$/), displayName: z.string().min(1).max(128), backendUrl: z.string().url(), region: z.enum(["us-central1","us-east1","europe-west1","asia-east1"]), protocol: z.enum(["HTTP","HTTPS","GRPC"]).default("HTTPS"), authType: z.enum(["API_KEY","JWT","NONE"]).default("API_KEY"), rateLimitRpm: z.number().int().min(10).max(100000).default(1000) });

// ── Memorystore ───────────────────────────────────────────────────────────────
// GCP Cheat Sheet: Database — Memorystore: Managed Redis and Memcached
export interface MemorystoreInstance { id: string; projectId: string; name: string; engine: string; version: string; tier: string; memorySizeGb: number; region: string; host: string; port: number; status: string; highAvailability: boolean; hourlyCost: number; createdAt: string; }
export const CreateMemorystoreSchema = z.object({
  name: z.string().min(1).max(60).regex(/^[a-z][a-z0-9_-]*$/),
  engine: z.enum(["REDIS", "MEMCACHED"]),
  version: z.enum([
    // Redis versions (Cheat Sheet: Managed Redis)
    "REDIS_7_2", "REDIS_7_0", "REDIS_6_X",
    // Memcached (Cheat Sheet: Managed Memcached)
    "MEMCACHE_1_6",
  ]),
  tier: z.enum(["BASIC", "STANDARD_HA"]),
  memorySizeGb: z.number().int().min(1).max(300),
  region: z.enum(["us-central1", "us-east1", "europe-west1", "asia-east1"]),
});

// ── Cloud Armor ───────────────────────────────────────────────────────────────
// GCP Cheat Sheet: Networking — Cloud Armor: DDoS protection and WAF
export interface CloudArmorPolicy { id: string; projectId: string; name: string; description: string; type: string; defaultAction: string; rules: any[]; adaptiveProtection: boolean; createdAt: string; }
export const CreateCloudArmorSchema = z.object({ name: z.string().min(1).max(60).regex(/^[a-z][a-z0-9_-]*$/), description: z.string().max(256).default(""), type: z.enum(["CLOUD_ARMOR","CLOUD_ARMOR_EDGE"]).default("CLOUD_ARMOR"), defaultAction: z.enum(["allow","deny(403)","deny(404)","deny(502)"]).default("allow"), adaptiveProtection: z.boolean().default(false) });

// ══════════════════════════════════════════════════════════════════════════════
// v6.2 — Additional GCP Service Types & Schemas
// Covers services from the GCP Developer's Cheat Sheet not yet modelled.
// ══════════════════════════════════════════════════════════════════════════════

export const CreateFirestoreDBSchema = z.object({ name: z.string().min(1).max(60).default("(default)"), type: z.enum(["NATIVE","DATASTORE"]).default("NATIVE"), locationId: z.enum(["us-central1","us-east1","europe-west1","asia-east1"]) });
export const CreateLogSinkSchema = z.object({ name: z.string().min(1).max(60).regex(/^[a-z][a-z0-9_-]*$/), destination: z.string().min(1), filter: z.string().default("") });
export const CreateTaskQueueSchema = z.object({ name: z.string().min(1).max(60).regex(/^[a-z][a-z0-9_-]*$/), region: z.enum(["us-central1","us-east1","europe-west1","asia-east1"]), rateLimitPerSecond: z.number().min(1).max(5000).default(500), maxConcurrent: z.number().int().min(1).max(5000).default(1000), retryMaxAttempts: z.number().int().min(0).max(10).default(3) });

// Dataproc: Managed Spark and Hadoop (GCP Cheat Sheet: Data Analytics)
export const CreateDataprocClusterSchema = z.object({
  name: z.string().min(1).max(60).regex(/^[a-z][a-z0-9_-]*$/),
  region: z.enum(["us-central1","us-east1","europe-west1","asia-east1"]),
  masterType: z.enum(["n1-standard-2","n1-standard-4","n1-standard-8","n2-standard-4"]).default("n1-standard-4"),
  workerType: z.enum(["n1-standard-2","n1-standard-4","n2-standard-2"]).default("n1-standard-2"),
  workerCount: z.number().int().min(2).max(500).default(2),
  // Current Dataproc image versions as of 2024
  imageVersion: z.enum([
    "2.2-debian12", "2.2-rocky9",
    "2.1-debian11", "2.1-rocky8",
    "2.0-debian10",
  ]).default("2.2-debian12"),
  autoscaling: z.boolean().default(false),
});

export const CreateCDNConfigSchema = z.object({ name: z.string().min(1).max(60).regex(/^[a-z][a-z0-9_-]*$/), originUrl: z.string().url(), cacheMode: z.enum(["CACHE_ALL_STATIC","USE_ORIGIN_HEADERS","FORCE_CACHE_ALL"]).default("CACHE_ALL_STATIC"), defaultTtlSec: z.number().int().min(0).max(86400).default(3600) });
export const CreateFirewallRuleSchema = z.object({ name: z.string().min(1).max(60).regex(/^[a-z][a-z0-9_-]*$/), network: z.string().default("default"), direction: z.enum(["INGRESS","EGRESS"]), action: z.enum(["ALLOW","DENY"]), priority: z.number().int().min(0).max(65535).default(1000), sourceRanges: z.array(z.string()).default(["0.0.0.0/0"]), targetTags: z.array(z.string()).default([]), protocols: z.array(z.string()).min(1) });
export const CreateServiceAccountSchema = z.object({ name: z.string().min(6).max(30).regex(/^[a-z][a-z0-9-]*$/), displayName: z.string().min(1).max(100), description: z.string().max(256).default("") });
export const CreateBudgetSchema = z.object({ name: z.string().min(1).max(60), amountUSD: z.number().min(1).max(1000000), thresholds: z.array(z.number().min(0).max(2)).default([0.5, 0.8, 1.0]), notifyEmails: z.array(z.string().email()).default([]) });
export const CreateWorkflowSchema = z.object({ name: z.string().min(1).max(60).regex(/^[a-z][a-z0-9_-]*$/), region: z.enum(["us-central1","us-east1","europe-west1","asia-east1"]), description: z.string().max(256).default(""), sourceCode: z.string().max(10000).default("main:\n  steps:\n    - init:\n        assign:\n          - result: 'Hello'") });
export const CreateDeliveryPipelineSchema = z.object({ name: z.string().min(1).max(60).regex(/^[a-z][a-z0-9_-]*$/), description: z.string().max(256).default(""), region: z.enum(["us-central1","us-east1","europe-west1","asia-east1"]), stages: z.array(z.object({ name: z.string(), targetId: z.string(), profiles: z.array(z.string()).default([]) })).min(1).max(10) });
