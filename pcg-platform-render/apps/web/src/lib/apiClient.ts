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

function getToken():        string | null { return localStorage.getItem(ACCESS_TOKEN_KEY); }
function getRefreshToken(): string | null { return localStorage.getItem(REFRESH_TOKEN_KEY); }

export function storeTokens(accessToken: string, refreshToken: string): void {
  localStorage.setItem(ACCESS_TOKEN_KEY,  accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
}

export function clearTokens(): void {
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

  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    },
  });

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

  const res  = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    },
  });

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
