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
