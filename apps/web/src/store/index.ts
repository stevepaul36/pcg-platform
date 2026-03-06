// apps/web/src/store/index.ts
// Single global store — Zustand + Immer + devtools + persist

import { create } from "zustand";
import { immer  } from "zustand/middleware/immer";
import { devtools, persist } from "zustand/middleware";
import type {
  VMInstance, StorageBucket, SQLInstance, IAMMember,
  ActivityLogEntry, Announcement, Improvement, Plan, PlanQuota,
} from "@pcg/shared";
import {
  VMs, Storage, SQL, IAM, Logs, Auth, Announcements, Improvements,
  storeTokens, clearTokens,
} from "../lib/apiClient";

// ── State interfaces ──────────────────────────────────────────────────────────

interface AuthState {
  user:            { id: string; email: string; name: string } | null;
  token:           string | null;
  projectId:       string | null;
  projectName:     string | null;
  isAuthenticated: boolean;
  plan:            Plan;
  subscriptionEnd: string | null;
  quota:           PlanQuota | null;
}

interface ConsoleLog {
  id:    string;
  level: "INFO" | "SUCCESS" | "WARNING" | "ERROR";
  text:  string;
  ts:    number;
}

interface Toast {
  id:       string;
  message:  string;
  type:     "success" | "error" | "info";
  removing: boolean;
}

interface PaginationState {
  hasNextPage: boolean;
  nextCursor:  string | null;
}

interface UIState {
  page:             string;
  sidebarCollapsed: boolean;
  rightPanel:       "console" | "ai" | "log";
  consoleLogs:      ConsoleLog[];
  consoleLoading:   boolean;
  aiInsight:        string;
  aiEmail:          string | null;
  aiLoading:        boolean;
  toasts:           Toast[];
}

interface DataState {
  vms:           VMInstance[];
  buckets:       StorageBucket[];
  sqlInstances:  SQLInstance[];
  iamMembers:    IAMMember[];
  activityLogs:  ActivityLogEntry[];
  totalSpendUSD: number;
  announcements: Announcement[];
  improvements:  Improvement[];
  // voted improvement IDs (client-side dedup to disable button immediately)
  votedImprovements: Set<string>;
  pagination: {
    logs:          PaginationState;
    announcements: PaginationState;
    improvements:  PaginationState;
  };
  loading: {
    vms:           boolean;
    buckets:       boolean;
    sql:           boolean;
    iam:           boolean;
    logs:          boolean;
    announcements: boolean;
    improvements:  boolean;
  };
}

interface Actions {
  // Auth
  register:       (email: string, password: string, name: string) => Promise<void>;
  login:          (email: string, password: string) => Promise<void>;
  logout:         () => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;

  // UI
  setPage:           (page: string) => void;
  toggleSidebar:     () => void;
  setRightPanel:     (panel: UIState["rightPanel"]) => void;
  addConsoleLog:     (log: Omit<ConsoleLog, "id" | "ts">) => void;
  clearConsole:      () => void;
  setConsoleLoading: (loading: boolean) => void;
  setAIInsight:      (insight: string, email?: string | null) => void;
  setAILoading:      (loading: boolean) => void;
  addToast:          (message: string, type: Toast["type"]) => void;
  removeToast:       (id: string) => void;

  // Data loaders
  loadVMs:     () => Promise<void>;
  loadBuckets: () => Promise<void>;
  loadSQL:     () => Promise<void>;
  loadIAM:     () => Promise<void>;
  loadLogs:    (cursor?: string) => Promise<void>;

  // VM actions
  createVM: (payload: any) => Promise<VMInstance>;
  vmAction: (vmId: string, action: "start" | "stop" | "suspend" | "terminate") => Promise<void>;
  deleteVM: (vmId: string) => Promise<void>;
  patchVM:  (vmId: string, updates: Partial<VMInstance>) => void;

  // Storage actions
  createBucket: (payload: any) => Promise<StorageBucket>;
  deleteBucket: (bucketId: string) => Promise<void>;

  // SQL actions
  createSQL:  (payload: any) => Promise<SQLInstance>;
  deleteSQL:  (instanceId: string) => Promise<void>;

  // IAM actions
  grantIAM:  (payload: any) => Promise<IAMMember>;
  revokeIAM: (memberId: string) => Promise<void>;

  // Billing
  tickBilling:     (delta: number) => void;
  syncSpendFromDB: (spendUSD: number) => void;

  // Announcements
  loadAnnouncements: (cursor?: string) => Promise<void>;

  // Improvements
  loadImprovements:  (cursor?: string) => Promise<void>;
  upvoteImprovement: (id: string) => Promise<void>;
}

type Store = AuthState & UIState & DataState & Actions;

const EMPTY_PAGINATION: PaginationState = { hasNextPage: false, nextCursor: null };

// ── Store ─────────────────────────────────────────────────────────────────────

export const useStore = create<Store>()(
  devtools(
    persist(
      immer((set, get) => ({
        // ── Auth initial state ─────────────────────────────────────────────
        user: null, token: null, projectId: null, projectName: null,
        isAuthenticated: false, plan: "free" as Plan, subscriptionEnd: null, quota: null,

        // ── UI initial state ───────────────────────────────────────────────
        page: "dashboard", sidebarCollapsed: false, rightPanel: "console",
        consoleLogs: [], consoleLoading: false,
        aiInsight: "", aiEmail: null, aiLoading: false,
        toasts: [],

        // ── Data initial state ─────────────────────────────────────────────
        vms: [], buckets: [], sqlInstances: [], iamMembers: [], activityLogs: [],
        totalSpendUSD: 0,
        announcements: [], improvements: [],
        votedImprovements: new Set(),
        pagination: {
          logs:          { ...EMPTY_PAGINATION },
          announcements: { ...EMPTY_PAGINATION },
          improvements:  { ...EMPTY_PAGINATION },
        },
        loading: {
          vms: false, buckets: false, sql: false, iam: false, logs: false,
          announcements: false, improvements: false,
        },

        // ── Auth actions ───────────────────────────────────────────────────

        async register(email, password, name) {
          const result = await Auth.register({ email, password, name });
          storeTokens(result.accessToken, result.refreshToken);
          set(s => {
            s.user            = result.user;
            s.token           = result.accessToken;
            s.isAuthenticated = true;
            s.plan            = result.user.plan ?? "free";
            s.subscriptionEnd = result.user.subscriptionEnd ?? null;
          });
          const me = await Auth.me();
          if (me.projects[0]) {
            set(s => {
              s.projectId     = me.projects[0].id;
              s.projectName   = me.projects[0].name;
              s.totalSpendUSD = me.projects[0].totalSpendUSD ?? 0;
            });
          }
          if (me.quota) {
            set(s => { s.quota = me.quota; });
          }
        },

        async login(email, password) {
          const result = await Auth.login({ email, password });
          storeTokens(result.accessToken, result.refreshToken);
          set(s => {
            s.user            = result.user;
            s.token           = result.accessToken;
            s.isAuthenticated = true;
            s.plan            = result.user.plan   ?? "free";
            s.subscriptionEnd = result.user.subscriptionEnd ?? null;
          });
          // Load project list, live quota, and authoritative spend
          const me = await Auth.me();
          if (me.projects[0]) {
            set(s => {
              s.projectId     = me.projects[0].id;
              s.projectName   = me.projects[0].name;
              s.totalSpendUSD = me.projects[0].totalSpendUSD ?? 0;
            });
          }
          if (me.quota) {
            set(s => { s.quota = me.quota; });
          }
        },

        async logout() {
          await Auth.logout().catch(() => {});
          clearTokens();
          set(s => {
            s.user = null; s.token = null; s.isAuthenticated = false;
            s.projectId = null; s.plan = "free"; s.subscriptionEnd = null;
            s.quota = null; s.totalSpendUSD = 0;
            s.vms = []; s.buckets = []; s.sqlInstances = []; s.iamMembers = [];
            s.activityLogs = []; s.announcements = []; s.improvements = [];
          });
        },

        async changePassword(currentPassword, newPassword) {
          await Auth.changePassword({ currentPassword, newPassword });
          // All sessions are revoked server-side — log out locally too
          clearTokens();
          set(s => {
            s.user = null; s.token = null; s.isAuthenticated = false;
          });
        },

        // ── UI actions ─────────────────────────────────────────────────────

        setPage:       page => set(s => { s.page = page; }),
        toggleSidebar: ()   => set(s => { s.sidebarCollapsed = !s.sidebarCollapsed; }),
        setRightPanel: p    => set(s => { s.rightPanel = p; }),

        addConsoleLog(log) {
          set(s => {
            s.consoleLogs = [...s.consoleLogs, { ...log, id: uid(), ts: Date.now() }].slice(-200);
          });
        },
        clearConsole: () => set(s => { s.consoleLogs = []; }),
        setConsoleLoading(loading) {
          set(s => { s.consoleLoading = loading; });
          if (loading) set(s => { s.rightPanel = "console"; });
        },
        setAIInsight(insight, email = null) {
          set(s => { s.aiInsight = insight; s.aiEmail = email; s.aiLoading = false; });
          if (insight) set(s => { s.rightPanel = "ai"; });
        },
        setAILoading: l => set(s => { s.aiLoading = l; }),

        addToast(message, type) {
          const id = uid();
          set(s => { s.toasts = [...s.toasts, { id, message, type, removing: false }]; });
          setTimeout(() => {
            set(s => { const t = s.toasts.find(t => t.id === id); if (t) t.removing = true; });
            setTimeout(() => set(s => { s.toasts = s.toasts.filter(t => t.id !== id); }), 300);
          }, 3_200);
        },
        removeToast(id) {
          set(s => { const t = s.toasts.find(t => t.id === id); if (t) t.removing = true; });
          setTimeout(() => set(s => { s.toasts = s.toasts.filter(t => t.id !== id); }), 300);
        },

        // ── Data loaders ───────────────────────────────────────────────────
        // Fix: don't reset vms/buckets to [] before fetching — prevents UI flicker.

        async loadVMs() {
          const projectId = get().projectId; if (!projectId) return;
          set(s => { s.loading.vms = true; });
          try {
            const vms = await VMs.list(projectId);
            set(s => { s.vms = vms; });
          } finally { set(s => { s.loading.vms = false; }); }
        },

        async loadBuckets() {
          const projectId = get().projectId; if (!projectId) return;
          set(s => { s.loading.buckets = true; });
          try {
            const b = await Storage.listBuckets(projectId);
            set(s => { s.buckets = b; });
          } finally { set(s => { s.loading.buckets = false; }); }
        },

        async loadSQL() {
          const projectId = get().projectId; if (!projectId) return;
          set(s => { s.loading.sql = true; });
          try {
            const sql = await SQL.list(projectId);
            set(s => { s.sqlInstances = sql; });
          } finally { set(s => { s.loading.sql = false; }); }
        },

        async loadIAM() {
          const projectId = get().projectId; if (!projectId) return;
          set(s => { s.loading.iam = true; });
          try {
            const iam = await IAM.list(projectId);
            set(s => { s.iamMembers = iam; });
          } finally { set(s => { s.loading.iam = false; }); }
        },

        async loadLogs(cursor) {
          const projectId = get().projectId; if (!projectId) return;
          set(s => { s.loading.logs = true; });
          try {
            const result = await Logs.list(projectId, { limit: 50, cursor });
            set(s => {
              s.activityLogs            = cursor ? [...s.activityLogs, ...result.data] : result.data;
              s.pagination.logs.hasNextPage = result.hasNextPage;
              s.pagination.logs.nextCursor  = result.nextCursor;
            });
          } finally { set(s => { s.loading.logs = false; }); }
        },

        // ── VM actions ─────────────────────────────────────────────────────

        async createVM(payload) {
          const projectId = get().projectId!;
          const vm = await VMs.create(projectId, payload);
          set(s => { s.vms = [vm, ...s.vms]; });
          return vm;
        },

        async vmAction(vmId, action) {
          const projectId = get().projectId!;
          const updated = await VMs.action(projectId, vmId, action);
          set(s => { s.vms = s.vms.map(v => v.id === vmId ? updated : v); });
        },

        async deleteVM(vmId) {
          const projectId = get().projectId!;
          await VMs.delete(projectId, vmId);
          set(s => { s.vms = s.vms.filter(v => v.id !== vmId); });
        },

        patchVM(vmId, updates) {
          set(s => { s.vms = s.vms.map(v => v.id === vmId ? { ...v, ...updates } : v); });
        },

        // ── Storage actions ────────────────────────────────────────────────

        async createBucket(payload) {
          const projectId = get().projectId!;
          const bucket = await Storage.createBucket(projectId, payload);
          set(s => { s.buckets = [bucket, ...s.buckets]; });
          return bucket;
        },

        async deleteBucket(bucketId) {
          const projectId = get().projectId!;
          await Storage.deleteBucket(projectId, bucketId);
          set(s => { s.buckets = s.buckets.filter(b => b.id !== bucketId); });
        },

        // ── SQL actions ────────────────────────────────────────────────────

        async createSQL(payload) {
          const projectId = get().projectId!;
          const instance = await SQL.create(projectId, payload);
          set(s => { s.sqlInstances = [instance, ...s.sqlInstances]; });
          return instance;
        },

        async deleteSQL(instanceId) {
          const projectId = get().projectId!;
          await SQL.delete(projectId, instanceId);
          set(s => { s.sqlInstances = s.sqlInstances.filter(i => i.id !== instanceId); });
        },

        // ── IAM actions ────────────────────────────────────────────────────

        async grantIAM(payload) {
          const projectId = get().projectId!;
          const member = await IAM.grant(projectId, payload);
          set(s => { s.iamMembers = [member, ...s.iamMembers]; });
          return member;
        },

        async revokeIAM(memberId) {
          const projectId = get().projectId!;
          await IAM.revoke(projectId, memberId);
          set(s => { s.iamMembers = s.iamMembers.filter(m => m.id !== memberId); });
        },

        // ── Billing ────────────────────────────────────────────────────────

        tickBilling(delta) {
          set(s => { s.totalSpendUSD = parseFloat((s.totalSpendUSD + delta).toFixed(6)); });
        },

        syncSpendFromDB(spendUSD) {
          set(s => { s.totalSpendUSD = spendUSD; });
        },

        // ── Announcements ──────────────────────────────────────────────────

        async loadAnnouncements(cursor) {
          set(s => { s.loading.announcements = true; });
          try {
            const result = await Announcements.list({ limit: 20, cursor });
            set(s => {
              s.announcements = cursor ? [...s.announcements, ...result.data] : result.data;
              s.pagination.announcements.hasNextPage = result.hasNextPage;
              s.pagination.announcements.nextCursor  = result.nextCursor;
            });
          } finally { set(s => { s.loading.announcements = false; }); }
        },

        // ── Improvements ───────────────────────────────────────────────────

        async loadImprovements(cursor) {
          set(s => { s.loading.improvements = true; });
          try {
            const result = await Improvements.list({ limit: 20, cursor });
            set(s => {
              s.improvements = cursor ? [...s.improvements, ...result.data] : result.data;
              s.pagination.improvements.hasNextPage = result.hasNextPage;
              s.pagination.improvements.nextCursor  = result.nextCursor;
            });
          } finally { set(s => { s.loading.improvements = false; }); }
        },

        async upvoteImprovement(id) {
          // Optimistic update + client-side dedup
          if (get().votedImprovements.has(id)) return;
          set(s => {
            s.votedImprovements.add(id);
            s.improvements = s.improvements.map(i => i.id === id ? { ...i, votes: i.votes + 1 } : i);
          });
          try {
            const updated = await Improvements.upvote(id);
            // Reconcile server truth
            set(s => { s.improvements = s.improvements.map(i => i.id === id ? updated : i); });
          } catch (err: any) {
            // Roll back optimistic update on failure
            if (err.code !== "ALREADY_VOTED") {
              set(s => {
                s.votedImprovements.delete(id);
                s.improvements = s.improvements.map(i => i.id === id ? { ...i, votes: i.votes - 1 } : i);
              });
            }
            throw err;
          }
        },
      })),
      {
        name: "pcg-store",
        partialize: s => ({
          token:             s.token,
          user:              s.user,
          projectId:         s.projectId,
          projectName:       s.projectName,
          isAuthenticated:   s.isAuthenticated,
          plan:              s.plan,
          subscriptionEnd:   s.subscriptionEnd,
          votedImprovements: Array.from(s.votedImprovements),
        }),
        // votedImprovements is stored as array, rehydrate as Set
        merge: (persisted: any, current: any) => ({
          ...current,
          ...persisted,
          votedImprovements: new Set(persisted?.votedImprovements ?? []),
        }),
      },
    ),
  ),
);

// ── Helpers ───────────────────────────────────────────────────────────────────

function uid(): string { return Math.random().toString(36).slice(2, 9); }

// ── Selectors ─────────────────────────────────────────────────────────────────

export const useAuth       = () => useStore(s => ({ user: s.user, isAuthenticated: s.isAuthenticated, projectId: s.projectId }));
export const usePlan       = () => useStore(s => ({ plan: s.plan, subscriptionEnd: s.subscriptionEnd, quota: s.quota }));
export const useRunningVMs = () => useStore(s => s.vms.filter(v => v.status === "RUNNING"));
export const useHourlyRate = () => useStore(s =>
  s.vms.filter(v => v.status === "RUNNING").reduce((acc, v) => acc + v.hourlyCost + v.diskHourlyCost, 0),
);
export const useTotalSpend       = () => useStore(s => s.totalSpendUSD);
export const useAnnouncements    = () => useStore(s => s.announcements);
export const useImprovements     = () => useStore(s => s.improvements);
export const useHasVotedFor      = (id: string) => useStore(s => s.votedImprovements.has(id));
export const useImprovementPages = () => useStore(s => s.pagination.improvements);
