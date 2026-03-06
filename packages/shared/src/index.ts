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
  maxVMs:          number;
  maxBuckets:      number;
  maxSQLInstances: number;
  sessionDays:     number;
  label:           string;
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

export const MACHINE_TYPES = [
  "e2-micro", "e2-small", "e2-medium",
  "n1-standard-1", "n1-standard-2", "n1-standard-4",
  "n2-standard-2", "n2-standard-4",
  "c2-standard-4", "c2-standard-8",
] as const;

export const REGIONS = [
  "us-central1", "us-east1", "us-west1",
  "europe-west1", "europe-west2",
  "asia-south1", "asia-east1", "asia-southeast1",
] as const;

export const ZONES = [
  "us-central1-a", "us-central1-b", "us-central1-c",
  "us-east1-b", "us-east1-c", "us-east1-d",
  "us-west1-a", "us-west1-b",
  "europe-west1-b", "europe-west1-c",
  "europe-west2-a", "europe-west2-b",
  "asia-south1-a", "asia-south1-b",
  "asia-east1-a", "asia-east1-b",
  "asia-southeast1-a", "asia-southeast1-b",
] as const;

export const OS_IMAGES = [
  "debian-11", "debian-12",
  "ubuntu-2004-lts", "ubuntu-2204-lts", "ubuntu-2404-lts",
  "centos-stream-9", "rocky-linux-9",
  "windows-server-2022",
] as const;

export const SQL_TIERS = [
  "db-f1-micro", "db-g1-small",
  "db-n1-standard-1", "db-n1-standard-2",
] as const;

export const DB_VERSIONS: Record<string, string[]> = {
  "PostgreSQL":  ["POSTGRES_14", "POSTGRES_15", "POSTGRES_16"],
  "MySQL":       ["MYSQL_8_0", "MYSQL_8_4"],
  "SQL Server":  ["SQLSERVER_2019_STANDARD", "SQLSERVER_2022_STANDARD"],
};

// ── Zod validation schemas ────────────────────────────────────────────────────

export const CreateVMSchema = z.object({
  name:        z.string().regex(/^[a-z][a-z0-9-]{0,61}[a-z0-9]$/, "Invalid VM name"),
  zone:        z.enum(ZONES),
  region:      z.enum(REGIONS),
  machineType: z.enum(MACHINE_TYPES),
  diskGb:      z.number().int().min(10).max(65536),
  diskType:    z.enum(["pd-standard", "pd-balanced", "pd-ssd"]),
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
  runtime: z.enum(["nodejs20", "python311", "go121", "java17", "ruby32"]),
  region: z.string().min(1),
  entryPoint: z.string().min(1),
  trigger: z.enum(["HTTP", "PUBSUB", "STORAGE"]),
  memoryMb: z.number().int().min(128).max(16384).default(256),
  timeoutSec: z.number().int().min(1).max(540).default(60),
});

export const CreateGKEClusterSchema = z.object({
  name: z.string().min(1).max(40).regex(/^[a-z][a-z0-9-]+$/),
  zone: z.string().min(1),
  nodeCount: z.number().int().min(1).max(100).default(3),
  machineType: z.string().min(1),
  diskGb: z.number().int().min(10).max(2000).default(100),
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
export interface MemorystoreInstance { id: string; projectId: string; name: string; engine: string; version: string; tier: string; memorySizeGb: number; region: string; host: string; port: number; status: string; highAvailability: boolean; hourlyCost: number; createdAt: string; }
export const CreateMemorystoreSchema = z.object({ name: z.string().min(1).max(60).regex(/^[a-z][a-z0-9_-]*$/), engine: z.enum(["REDIS","MEMCACHED"]), version: z.enum(["REDIS_7_0","REDIS_6_X","MEMCACHE_1_6"]), tier: z.enum(["BASIC","STANDARD_HA"]), memorySizeGb: z.number().int().min(1).max(300), region: z.enum(["us-central1","us-east1","europe-west1","asia-east1"]) });

// ── Cloud Armor ───────────────────────────────────────────────────────────────
export interface CloudArmorPolicy { id: string; projectId: string; name: string; description: string; type: string; defaultAction: string; rules: any[]; adaptiveProtection: boolean; createdAt: string; }
export const CreateCloudArmorSchema = z.object({ name: z.string().min(1).max(60).regex(/^[a-z][a-z0-9_-]*$/), description: z.string().max(256).default(""), type: z.enum(["CLOUD_ARMOR","CLOUD_ARMOR_EDGE"]).default("CLOUD_ARMOR"), defaultAction: z.enum(["allow","deny(403)","deny(404)","deny(502)"]).default("allow"), adaptiveProtection: z.boolean().default(false) });
