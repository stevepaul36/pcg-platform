// apps/web/src/lib/apiClient.ts
// Central typed API client. All HTTP requests flow through here.
// Features: automatic access-token refresh, retry on 429, typed responses.

import type {
  ApiResponse,
  VMInstance,
  StorageBucket,
  SQLInstance,
  IAMMember,
  ActivityLogEntry,
  Announcement,
  Improvement,
  PlanQuota,
} from "@pcg/shared";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

const ACCESS_TOKEN_KEY  = "pcg_token";
const REFRESH_TOKEN_KEY = "pcg_refresh_token";

// ── Error class ───────────────────────────────────────────────────────────────

export class APIError extends Error {
  constructor(
    public code:     string,
    message:         string,
    public status:   number,
    public details?: unknown,
  ) {
    super(message);
    this.name = "APIError";
  }
}

// ── Token helpers ─────────────────────────────────────────────────────────────

const isBrowser = typeof window !== "undefined";

function getToken():        string | null { return isBrowser ? localStorage.getItem(ACCESS_TOKEN_KEY) : null; }
function getRefreshToken(): string | null { return isBrowser ? localStorage.getItem(REFRESH_TOKEN_KEY) : null; }

export function storeTokens(accessToken: string, refreshToken: string): void {
  if (!isBrowser) return;
  localStorage.setItem(ACCESS_TOKEN_KEY,  accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
}

export function clearTokens(): void {
  if (!isBrowser) return;
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

// Prevents multiple simultaneous refresh calls
let refreshPromise: Promise<string> | null = null;

async function refreshAccessToken(): Promise<string> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) throw new APIError("UNAUTHENTICATED", "No refresh token available", 401);

  const res  = await fetch(`${API_BASE}/auth/refresh`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ refreshToken }),
  });
  const body = await res.json();

  if (!res.ok || !body.success) {
    clearTokens();
    throw new APIError(body.error?.code ?? "REFRESH_FAILED", "Session expired. Please sign in again.", 401);
  }

  const { accessToken, refreshToken: newRefreshToken } = body.data;
  storeTokens(accessToken, newRefreshToken);
  return accessToken;
}

// ── Core fetch wrapper ────────────────────────────────────────────────────────

async function apiFetch<T>(
  endpoint: string,
  options:  RequestInit = {},
  _retries = 1,
): Promise<T> {
  const token = getToken();

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(token && { Authorization: `Bearer ${token}` }),
        ...options.headers,
      },
    });
  } catch (networkErr: any) {
    // fetch() itself threw — API is unreachable (CORS, server down, network issue)
    const msg = networkErr?.message ?? "Network error";
    throw new APIError(
      "NETWORK_ERROR",
      `Cannot reach API server (${API_BASE}). Is pcg-api running? Check CORS_ORIGINS env var. [${msg}]`,
      0,
    );
  }

  // Automatic retry after rate-limit back-off
  if (res.status === 429 && _retries > 0) {
    const retryAfter = parseInt(res.headers.get("Retry-After") ?? "2", 10);
    await sleep(retryAfter * 1_000);
    return apiFetch(endpoint, options, _retries - 1);
  }

  // Access token expired — attempt silent refresh once
  if (res.status === 401 && _retries > 0) {
    const body: ApiResponse<T> = await res.json().catch(() => ({ success: false, error: { code: "PARSE_ERROR", message: "Failed to parse response" } }));
    const code = (body as any).error?.code;

    if (code === "TOKEN_EXPIRED" || code === "SESSION_EXPIRED") {
      if (!refreshPromise) {
        refreshPromise = refreshAccessToken().finally(() => { refreshPromise = null; });
      }
      try {
        await refreshPromise;
        return apiFetch(endpoint, options, 0);   // retry once with new token
      } catch {
        throw new APIError(code, "Session expired. Please sign in again.", 401);
      }
    }

    throw new APIError(code ?? "UNAUTHORIZED", (body as any).error?.message ?? "Unauthorized", 401);
  }

  const body: ApiResponse<T> = await res.json();

  if (!body.success) {
    throw new APIError(body.error!.code, body.error!.message, res.status, body.error!.details);
  }

  return body.data as T;
}

// Paginated fetch — reuses core apiFetch logic for 401/429 handling
async function apiFetchPaged<T>(
  endpoint: string,
  options:  RequestInit = {},
  _retries = 1,
): Promise<{ data: T[]; hasNextPage: boolean; nextCursor: string | null }> {
  const token = getToken();

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(token && { Authorization: `Bearer ${token}` }),
        ...options.headers,
      },
    });
  } catch (networkErr: any) {
    throw new APIError("NETWORK_ERROR",
      `Cannot reach API server. Check CORS_ORIGINS env var on pcg-api. [${networkErr?.message ?? "Network error"}]`, 0);
  }

  // Rate-limit retry
  if (res.status === 429 && _retries > 0) {
    const retryAfter = parseInt(res.headers.get("Retry-After") ?? "2", 10);
    await sleep(retryAfter * 1_000);
    return apiFetchPaged(endpoint, options, _retries - 1);
  }

  // Access token expired — attempt silent refresh
  if (res.status === 401 && _retries > 0) {
    const body = await res.json().catch(() => ({ success: false, error: { code: "PARSE_ERROR" } }));
    const code = body?.error?.code;

    if (code === "TOKEN_EXPIRED" || code === "SESSION_EXPIRED") {
      if (!refreshPromise) {
        refreshPromise = refreshAccessToken().finally(() => { refreshPromise = null; });
      }
      try {
        await refreshPromise;
        return apiFetchPaged(endpoint, options, 0); // retry once with new token
      } catch {
        throw new APIError(code, "Session expired. Please sign in again.", 401);
      }
    }

    throw new APIError(code ?? "UNAUTHORIZED", body?.error?.message ?? "Unauthorized", 401);
  }

  const body = await res.json();
  if (!body.success) {
    throw new APIError(body.error!.code, body.error!.message, res.status, body.error!.details);
  }

  return {
    data:        body.data,
    hasNextPage: body.meta?.hasNextPage ?? false,
    nextCursor:  body.meta?.nextCursor  ?? null,
  };
}

// ── Auth ──────────────────────────────────────────────────────────────────────

export const Auth = {
  register: (payload: { email: string; password: string; name: string }) =>
    apiFetch<{ user: any; accessToken: string; refreshToken: string; expiresAt: string; detectedPlan: string }>(
      "/auth/register",
      { method: "POST", body: JSON.stringify(payload) },
    ),

  login: (payload: { email: string; password: string }) =>
    apiFetch<{ user: any; accessToken: string; refreshToken: string; expiresAt: string }>(
      "/auth/login",
      { method: "POST", body: JSON.stringify(payload) },
    ),

  logout: () =>
    apiFetch<null>("/auth/logout", { method: "POST" }),

  me: () =>
    apiFetch<{ user: any; projects: any[]; quota: PlanQuota }>("/auth/me"),

  changePassword: (payload: { currentPassword: string; newPassword: string }) =>
    apiFetch<{ message: string }>("/auth/change-password", {
      method: "POST", body: JSON.stringify(payload),
    }),

  forgotPassword: (email: string) =>
    apiFetch<{ message: string }>("/auth/forgot-password", {
      method: "POST", body: JSON.stringify({ email }),
    }),

  resetPassword: (payload: { token: string; newPassword: string }) =>
    apiFetch<{ message: string }>("/auth/reset-password", {
      method: "POST", body: JSON.stringify(payload),
    }),
};

// ── VMs ───────────────────────────────────────────────────────────────────────

export const VMs = {
  list: (projectId: string) =>
    apiFetch<VMInstance[]>(`/vms/${projectId}`),

  create: (projectId: string, payload: any) =>
    apiFetch<VMInstance>(`/vms/${projectId}`, {
      method: "POST", body: JSON.stringify(payload),
    }),

  action: (
    projectId: string,
    vmId:      string,
    action:    "start" | "stop" | "suspend" | "terminate",
  ) =>
    apiFetch<VMInstance>(`/vms/${projectId}/${vmId}/action`, {
      method: "PATCH", body: JSON.stringify({ action }),
    }),

  delete: (projectId: string, vmId: string) =>
    apiFetch<null>(`/vms/${projectId}/${vmId}`, { method: "DELETE" }),
};

// ── Storage ───────────────────────────────────────────────────────────────────

export const Storage = {
  listBuckets: (projectId: string) =>
    apiFetch<StorageBucket[]>(`/storage/${projectId}/buckets`),

  createBucket: (projectId: string, payload: any) =>
    apiFetch<StorageBucket>(`/storage/${projectId}/buckets`, {
      method: "POST", body: JSON.stringify(payload),
    }),

  deleteBucket: (projectId: string, bucketId: string) =>
    apiFetch<null>(`/storage/${projectId}/buckets/${bucketId}`, { method: "DELETE" }),

  listObjects: (projectId: string, bucketId: string) =>
    apiFetch<any[]>(`/storage/${projectId}/buckets/${bucketId}/objects`),

  uploadObject: (projectId: string, bucketId: string, payload: any) =>
    apiFetch<any>(`/storage/${projectId}/buckets/${bucketId}/objects`, {
      method: "POST", body: JSON.stringify(payload),
    }),

  deleteObject: (projectId: string, bucketId: string, objectId: string) =>
    apiFetch<null>(`/storage/${projectId}/buckets/${bucketId}/objects/${objectId}`, { method: "DELETE" }),
};

// ── SQL ───────────────────────────────────────────────────────────────────────

export const SQL = {
  list:   (projectId: string) =>
    apiFetch<SQLInstance[]>(`/sql/${projectId}`),

  create: (projectId: string, payload: any) =>
    apiFetch<SQLInstance>(`/sql/${projectId}`, {
      method: "POST", body: JSON.stringify(payload),
    }),

  delete: (projectId: string, instanceId: string) =>
    apiFetch<null>(`/sql/${projectId}/${instanceId}`, { method: "DELETE" }),
};

// ── IAM ───────────────────────────────────────────────────────────────────────

export const IAM = {
  list:   (projectId: string) =>
    apiFetch<IAMMember[]>(`/iam/${projectId}`),

  grant:  (projectId: string, payload: any) =>
    apiFetch<IAMMember>(`/iam/${projectId}`, {
      method: "POST", body: JSON.stringify(payload),
    }),

  revoke: (projectId: string, memberId: string) =>
    apiFetch<null>(`/iam/${projectId}/${memberId}`, { method: "DELETE" }),
};

// ── Logs ──────────────────────────────────────────────────────────────────────

export const Logs = {
  list: (projectId: string, params?: { limit?: number; type?: string; cursor?: string }) => {
    const qs = params ? "?" + new URLSearchParams(params as any).toString() : "";
    return apiFetchPaged<ActivityLogEntry>(`/logs/${projectId}${qs}`);
  },
};

// ── Announcements ─────────────────────────────────────────────────────────────

export const Announcements = {
  list: (params?: { limit?: number; cursor?: string }) => {
    const qs = params ? "?" + new URLSearchParams(params as any).toString() : "";
    return apiFetchPaged<Announcement>(`/announcements${qs}`);
  },

  create: (payload: {
    title: string;
    body: string;
    type?: "info" | "warning" | "feature" | "maintenance";
    pinned?: boolean;
    expiresAt?: string;
  }) =>
    apiFetch<Announcement>("/announcements", {
      method: "POST", body: JSON.stringify(payload),
    }),

  update: (id: string, payload: {
    title?: string;
    body?: string;
    type?: "info" | "warning" | "feature" | "maintenance";
    pinned?: boolean;
    expiresAt?: string | null;
  }) =>
    apiFetch<Announcement>(`/announcements/${id}`, {
      method: "PATCH", body: JSON.stringify(payload),
    }),

  delete: (id: string) =>
    apiFetch<null>(`/announcements/${id}`, { method: "DELETE" }),
};

// ── Improvements ──────────────────────────────────────────────────────────────

export const Improvements = {
  list: (params?: { status?: string; category?: string; limit?: number; cursor?: string }) => {
    const qs = params ? "?" + new URLSearchParams(params as any).toString() : "";
    return apiFetchPaged<Improvement>(`/improvements${qs}`);
  },

  create: (payload: {
    title:       string;
    description: string;
    priority?:   "low" | "medium" | "high" | "critical";
    category?:   "feature" | "bug" | "performance" | "ux";
  }) =>
    apiFetch<Improvement>("/improvements", {
      method: "POST", body: JSON.stringify(payload),
    }),

  upvote: (id: string) =>
    apiFetch<Improvement>(`/improvements/${id}`, {
      method: "PATCH", body: JSON.stringify({ vote: true }),
    }),

  updateStatus: (id: string, status: "planned" | "in_progress" | "completed" | "cancelled") =>
    apiFetch<Improvement>(`/improvements/${id}`, {
      method: "PATCH", body: JSON.stringify({ status }),
    }),

  updatePriority: (id: string, priority: "low" | "medium" | "high" | "critical") =>
    apiFetch<Improvement>(`/improvements/${id}`, {
      method: "PATCH", body: JSON.stringify({ priority }),
    }),

  delete: (id: string) =>
    apiFetch<null>(`/improvements/${id}`, { method: "DELETE" }),
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

// ── Projects ──────────────────────────────────────────────────────────────────

export const Projects = {
  list: () =>
    apiFetch<any[]>("/projects"),

  get: (projectId: string) =>
    apiFetch<any>(`/projects/${projectId}`),

  create: (payload: { displayName: string }) =>
    apiFetch<any>("/projects", {
      method: "POST", body: JSON.stringify(payload),
    }),

  update: (projectId: string, payload: { displayName: string }) =>
    apiFetch<any>(`/projects/${projectId}`, {
      method: "PATCH", body: JSON.stringify(payload),
    }),

  delete: (projectId: string) =>
    apiFetch<null>(`/projects/${projectId}`, { method: "DELETE" }),
};

// ── Metrics ───────────────────────────────────────────────────────────────────

export const Metrics = {
  get: (projectId: string) =>
    apiFetch<any>(`/metrics/${projectId}`),
};

// ── BigQuery ───────────────────────────────────────────────────────────────────
export const BigQuery = {
  list: (projectId: string) => apiFetch<any[]>(`/bigquery/${projectId}`),
  createDataset: (projectId: string, payload: any) =>
    apiFetch<any>(`/bigquery/${projectId}/datasets`, { method: "POST", body: JSON.stringify(payload) }),
  deleteDataset: (projectId: string, datasetId: string) =>
    apiFetch<null>(`/bigquery/${projectId}/datasets/${datasetId}`, { method: "DELETE" }),
  createTable: (projectId: string, datasetId: string, payload: any) =>
    apiFetch<any>(`/bigquery/${projectId}/datasets/${datasetId}/tables`, { method: "POST", body: JSON.stringify(payload) }),
  deleteTable: (projectId: string, tableId: string) =>
    apiFetch<null>(`/bigquery/${projectId}/tables/${tableId}`, { method: "DELETE" }),
};

// ── Pub/Sub ────────────────────────────────────────────────────────────────────
export const PubSub = {
  list: (projectId: string) => apiFetch<any[]>(`/pubsub/${projectId}`),
  createTopic: (projectId: string, payload: any) =>
    apiFetch<any>(`/pubsub/${projectId}/topics`, { method: "POST", body: JSON.stringify(payload) }),
  deleteTopic: (projectId: string, topicId: string) =>
    apiFetch<null>(`/pubsub/${projectId}/topics/${topicId}`, { method: "DELETE" }),
  createSubscription: (projectId: string, topicId: string, payload: any) =>
    apiFetch<any>(`/pubsub/${projectId}/topics/${topicId}/subscriptions`, { method: "POST", body: JSON.stringify(payload) }),
  deleteSubscription: (projectId: string, subId: string) =>
    apiFetch<null>(`/pubsub/${projectId}/subscriptions/${subId}`, { method: "DELETE" }),
};

// ── Cloud Functions ────────────────────────────────────────────────────────────
export const Functions = {
  list: (projectId: string) => apiFetch<any[]>(`/functions/${projectId}`),
  create: (projectId: string, payload: any) =>
    apiFetch<any>(`/functions/${projectId}`, { method: "POST", body: JSON.stringify(payload) }),
  delete: (projectId: string, fnId: string) =>
    apiFetch<null>(`/functions/${projectId}/${fnId}`, { method: "DELETE" }),
};

// ── GKE ────────────────────────────────────────────────────────────────────────
export const GKE = {
  list: (projectId: string) => apiFetch<any[]>(`/gke/${projectId}`),
  create: (projectId: string, payload: any) =>
    apiFetch<any>(`/gke/${projectId}`, { method: "POST", body: JSON.stringify(payload) }),
  delete: (projectId: string, clusterId: string) =>
    apiFetch<null>(`/gke/${projectId}/${clusterId}`, { method: "DELETE" }),
};

// ── Cloud Run ──────────────────────────────────────────────────────────────────
export const CloudRun = {
  list: (projectId: string) => apiFetch<any[]>(`/cloudrun/${projectId}`),
  create: (projectId: string, payload: any) =>
    apiFetch<any>(`/cloudrun/${projectId}`, { method: "POST", body: JSON.stringify(payload) }),
  delete: (projectId: string, serviceId: string) =>
    apiFetch<null>(`/cloudrun/${projectId}/${serviceId}`, { method: "DELETE" }),
};

// ── Networking ─────────────────────────────────────────────────────────────────
export const Networking = {
  listVPCs: (projectId: string) => apiFetch<any[]>(`/networking/${projectId}/vpcs`),
  createVPC: (projectId: string, payload: any) =>
    apiFetch<any>(`/networking/${projectId}/vpcs`, { method: "POST", body: JSON.stringify(payload) }),
  deleteVPC: (projectId: string, vpcId: string) =>
    apiFetch<null>(`/networking/${projectId}/vpcs/${vpcId}`, { method: "DELETE" }),
  listLBs: (projectId: string) => apiFetch<any[]>(`/networking/${projectId}/loadbalancers`),
  createLB: (projectId: string, payload: any) =>
    apiFetch<any>(`/networking/${projectId}/loadbalancers`, { method: "POST", body: JSON.stringify(payload) }),
  deleteLB: (projectId: string, lbId: string) =>
    apiFetch<null>(`/networking/${projectId}/loadbalancers/${lbId}`, { method: "DELETE" }),
  listDNS: (projectId: string) => apiFetch<any[]>(`/networking/${projectId}/dns`),
  createDNS: (projectId: string, payload: any) =>
    apiFetch<any>(`/networking/${projectId}/dns`, { method: "POST", body: JSON.stringify(payload) }),
  deleteDNS: (projectId: string, zoneId: string) =>
    apiFetch<null>(`/networking/${projectId}/dns/${zoneId}`, { method: "DELETE" }),
};

// ── Security ───────────────────────────────────────────────────────────────────
export const Security = {
  listSecrets: (projectId: string) => apiFetch<any[]>(`/security/${projectId}/secrets`),
  createSecret: (projectId: string, payload: any) =>
    apiFetch<any>(`/security/${projectId}/secrets`, { method: "POST", body: JSON.stringify(payload) }),
  deleteSecret: (projectId: string, secretId: string) =>
    apiFetch<null>(`/security/${projectId}/secrets/${secretId}`, { method: "DELETE" }),
  listKeyRings: (projectId: string) => apiFetch<any[]>(`/security/${projectId}/keyrings`),
  createKeyRing: (projectId: string, payload: any) =>
    apiFetch<any>(`/security/${projectId}/keyrings`, { method: "POST", body: JSON.stringify(payload) }),
  createKey: (projectId: string, ringId: string, payload: any) =>
    apiFetch<any>(`/security/${projectId}/keyrings/${ringId}/keys`, { method: "POST", body: JSON.stringify(payload) }),
  deleteKeyRing: (projectId: string, ringId: string) =>
    apiFetch<null>(`/security/${projectId}/keyrings/${ringId}`, { method: "DELETE" }),
};

// ── Vertex AI ──────────────────────────────────────────────────────────────────
export const VertexAI = {
  listModels: (projectId: string) => apiFetch<any[]>(`/vertexai/${projectId}/models`),
  createModel: (projectId: string, payload: any) =>
    apiFetch<any>(`/vertexai/${projectId}/models`, { method: "POST", body: JSON.stringify(payload) }),
  deleteModel: (projectId: string, modelId: string) =>
    apiFetch<null>(`/vertexai/${projectId}/models/${modelId}`, { method: "DELETE" }),
  createEndpoint: (projectId: string, modelId: string, payload: any) =>
    apiFetch<any>(`/vertexai/${projectId}/models/${modelId}/endpoints`, { method: "POST", body: JSON.stringify(payload) }),
};

// ── Dataflow ───────────────────────────────────────────────────────────────────
export const Dataflow = {
  list: (projectId: string) => apiFetch<any[]>(`/dataflow/${projectId}`),
  create: (projectId: string, payload: any) =>
    apiFetch<any>(`/dataflow/${projectId}`, { method: "POST", body: JSON.stringify(payload) }),
  cancel: (projectId: string, jobId: string) =>
    apiFetch<any>(`/dataflow/${projectId}/${jobId}/cancel`, { method: "POST" }),
  delete: (projectId: string, jobId: string) =>
    apiFetch<null>(`/dataflow/${projectId}/${jobId}`, { method: "DELETE" }),
};

// ── Cloud Monitoring ───────────────────────────────────────────────────────────
export const Monitoring = {
  listAlerts: (pid: string) => apiFetch<any[]>(`/monitoring/${pid}/alerts`),
  createAlert: (pid: string, p: any) => apiFetch<any>(`/monitoring/${pid}/alerts`, { method: "POST", body: JSON.stringify(p) }),
  deleteAlert: (pid: string, id: string) => apiFetch<null>(`/monitoring/${pid}/alerts/${id}`, { method: "DELETE" }),
  listUptime: (pid: string) => apiFetch<any[]>(`/monitoring/${pid}/uptime`),
  createUptime: (pid: string, p: any) => apiFetch<any>(`/monitoring/${pid}/uptime`, { method: "POST", body: JSON.stringify(p) }),
  deleteUptime: (pid: string, id: string) => apiFetch<null>(`/monitoring/${pid}/uptime/${id}`, { method: "DELETE" }),
};

// ── Cloud Build ────────────────────────────────────────────────────────────────
export const CloudBuild = {
  list: (pid: string) => apiFetch<any[]>(`/cloudbuild/${pid}`),
  create: (pid: string, p: any) => apiFetch<any>(`/cloudbuild/${pid}`, { method: "POST", body: JSON.stringify(p) }),
  delete: (pid: string, id: string) => apiFetch<null>(`/cloudbuild/${pid}/${id}`, { method: "DELETE" }),
};

// ── Artifact Registry ──────────────────────────────────────────────────────────
export const ArtifactRegistry = {
  list: (pid: string) => apiFetch<any[]>(`/artifacts/${pid}`),
  create: (pid: string, p: any) => apiFetch<any>(`/artifacts/${pid}`, { method: "POST", body: JSON.stringify(p) }),
  delete: (pid: string, id: string) => apiFetch<null>(`/artifacts/${pid}/${id}`, { method: "DELETE" }),
};

// ── Cloud Scheduler ────────────────────────────────────────────────────────────
export const Scheduler = {
  list: (pid: string) => apiFetch<any[]>(`/scheduler/${pid}`),
  create: (pid: string, p: any) => apiFetch<any>(`/scheduler/${pid}`, { method: "POST", body: JSON.stringify(p) }),
  toggle: (pid: string, id: string, status: string) => apiFetch<any>(`/scheduler/${pid}/${id}`, { method: "PATCH", body: JSON.stringify({ status }) }),
  delete: (pid: string, id: string) => apiFetch<null>(`/scheduler/${pid}/${id}`, { method: "DELETE" }),
};

// ── API Gateway ────────────────────────────────────────────────────────────────
export const ApiGatewayApi = {
  list: (pid: string) => apiFetch<any[]>(`/apigateway/${pid}`),
  create: (pid: string, p: any) => apiFetch<any>(`/apigateway/${pid}`, { method: "POST", body: JSON.stringify(p) }),
  delete: (pid: string, id: string) => apiFetch<null>(`/apigateway/${pid}/${id}`, { method: "DELETE" }),
};

// ── Memorystore ────────────────────────────────────────────────────────────────
export const MemorystoreApi = {
  list: (pid: string) => apiFetch<any[]>(`/memorystore/${pid}`),
  create: (pid: string, p: any) => apiFetch<any>(`/memorystore/${pid}`, { method: "POST", body: JSON.stringify(p) }),
  delete: (pid: string, id: string) => apiFetch<null>(`/memorystore/${pid}/${id}`, { method: "DELETE" }),
};

// ── Cloud Armor ────────────────────────────────────────────────────────────────
export const CloudArmorApi = {
  list: (pid: string) => apiFetch<any[]>(`/cloudarmor/${pid}`),
  create: (pid: string, p: any) => apiFetch<any>(`/cloudarmor/${pid}`, { method: "POST", body: JSON.stringify(p) }),
  delete: (pid: string, id: string) => apiFetch<null>(`/cloudarmor/${pid}/${id}`, { method: "DELETE" }),
};

// ═══ v6.0 — 10 New GCP Services ═══════════════════════════════════════════════
export const FirestoreApi = {
  list: (pid: string) => apiFetch<any[]>(`/firestore/${pid}`),
  create: (pid: string, p: any) => apiFetch<any>(`/firestore/${pid}`, { method: "POST", body: JSON.stringify(p) }),
  delete: (pid: string, id: string) => apiFetch<null>(`/firestore/${pid}/${id}`, { method: "DELETE" }),
};
export const LoggingApi = {
  list: (pid: string) => apiFetch<any[]>(`/logging/${pid}`),
  create: (pid: string, p: any) => apiFetch<any>(`/logging/${pid}`, { method: "POST", body: JSON.stringify(p) }),
  delete: (pid: string, id: string) => apiFetch<null>(`/logging/${pid}/${id}`, { method: "DELETE" }),
};
export const TasksApi = {
  list: (pid: string) => apiFetch<any[]>(`/tasks/${pid}`),
  create: (pid: string, p: any) => apiFetch<any>(`/tasks/${pid}`, { method: "POST", body: JSON.stringify(p) }),
  toggle: (pid: string, id: string, status: string) => apiFetch<any>(`/tasks/${pid}/${id}`, { method: "PATCH", body: JSON.stringify({ status }) }),
  delete: (pid: string, id: string) => apiFetch<null>(`/tasks/${pid}/${id}`, { method: "DELETE" }),
};
export const DataprocApi = {
  list: (pid: string) => apiFetch<any[]>(`/dataproc/${pid}`),
  create: (pid: string, p: any) => apiFetch<any>(`/dataproc/${pid}`, { method: "POST", body: JSON.stringify(p) }),
  delete: (pid: string, id: string) => apiFetch<null>(`/dataproc/${pid}/${id}`, { method: "DELETE" }),
};
export const CDNApi = {
  list: (pid: string) => apiFetch<any[]>(`/cdn/${pid}`),
  create: (pid: string, p: any) => apiFetch<any>(`/cdn/${pid}`, { method: "POST", body: JSON.stringify(p) }),
  delete: (pid: string, id: string) => apiFetch<null>(`/cdn/${pid}/${id}`, { method: "DELETE" }),
};
export const FirewallApi = {
  list: (pid: string) => apiFetch<any[]>(`/firewall/${pid}`),
  create: (pid: string, p: any) => apiFetch<any>(`/firewall/${pid}`, { method: "POST", body: JSON.stringify(p) }),
  delete: (pid: string, id: string) => apiFetch<null>(`/firewall/${pid}/${id}`, { method: "DELETE" }),
};
export const ServiceAccountsApi = {
  list: (pid: string) => apiFetch<any[]>(`/serviceaccounts/${pid}`),
  create: (pid: string, p: any) => apiFetch<any>(`/serviceaccounts/${pid}`, { method: "POST", body: JSON.stringify(p) }),
  delete: (pid: string, id: string) => apiFetch<null>(`/serviceaccounts/${pid}/${id}`, { method: "DELETE" }),
};
export const BudgetsApi = {
  list: (pid: string) => apiFetch<any[]>(`/budgets/${pid}`),
  create: (pid: string, p: any) => apiFetch<any>(`/budgets/${pid}`, { method: "POST", body: JSON.stringify(p) }),
  delete: (pid: string, id: string) => apiFetch<null>(`/budgets/${pid}/${id}`, { method: "DELETE" }),
};
export const WorkflowsApi = {
  list: (pid: string) => apiFetch<any[]>(`/workflows/${pid}`),
  create: (pid: string, p: any) => apiFetch<any>(`/workflows/${pid}`, { method: "POST", body: JSON.stringify(p) }),
  execute: (pid: string, id: string) => apiFetch<any>(`/workflows/${pid}/${id}/execute`, { method: "POST" }),
  delete: (pid: string, id: string) => apiFetch<null>(`/workflows/${pid}/${id}`, { method: "DELETE" }),
};
export const DeployApi = {
  list: (pid: string) => apiFetch<any[]>(`/deploy/${pid}`),
  create: (pid: string, p: any) => apiFetch<any>(`/deploy/${pid}`, { method: "POST", body: JSON.stringify(p) }),
  delete: (pid: string, id: string) => apiFetch<null>(`/deploy/${pid}/${id}`, { method: "DELETE" }),
};
