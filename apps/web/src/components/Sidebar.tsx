"use client";

import { useStore } from "../store";
import {
  LayoutDashboard, Server, HardDrive, Database, Shield,
  ScrollText, Megaphone, LogOut, User, Radio, Zap,
  Container, Wind, Network, Lock, Brain, GitBranch,
  ChevronDown, ChevronRight, Table2, Bell, Hammer,
  Package, Clock, Globe, Cpu, ShieldAlert,
} from "lucide-react";
import { useState } from "react";

interface NavItem { id: string; label: string; icon: any; }
interface NavGroup { label: string; items: NavItem[]; }

const NAV_GROUPS: NavGroup[] = [
  {
    label: "Overview",
    items: [{ id: "dashboard", label: "Dashboard", icon: LayoutDashboard }],
  },
  {
    label: "Compute",
    items: [
      { id: "compute",   label: "Compute Engine",    icon: Server },
      { id: "gke",       label: "Kubernetes Engine",  icon: Container },
      { id: "cloudrun",  label: "Cloud Run",          icon: Wind },
      { id: "functions", label: "Cloud Functions",    icon: Zap },
    ],
  },
  {
    label: "Storage & Data",
    items: [
      { id: "storage",     label: "Cloud Storage",    icon: HardDrive },
      { id: "sql",         label: "Cloud SQL",        icon: Database },
      { id: "memorystore", label: "Memorystore",      icon: Cpu },
      { id: "bigquery",    label: "BigQuery",         icon: Table2 },
    ],
  },
  {
    label: "Messaging & Analytics",
    items: [
      { id: "pubsub",    label: "Pub/Sub",     icon: Radio },
      { id: "dataflow",  label: "Dataflow",    icon: GitBranch },
    ],
  },
  {
    label: "AI & ML",
    items: [
      { id: "vertexai",  label: "Vertex AI",   icon: Brain },
    ],
  },
  {
    label: "Networking",
    items: [
      { id: "networking", label: "VPC & Networking", icon: Network },
      { id: "apigateway", label: "API Gateway",      icon: Globe },
    ],
  },
  {
    label: "Security",
    items: [
      { id: "iam",        label: "IAM & Admin",          icon: Shield },
      { id: "security",   label: "Secret Manager & KMS", icon: Lock },
      { id: "cloudarmor", label: "Cloud Armor",           icon: ShieldAlert },
    ],
  },
  {
    label: "CI/CD & DevOps",
    items: [
      { id: "cloudbuild", label: "Cloud Build",       icon: Hammer },
      { id: "artifacts",  label: "Artifact Registry", icon: Package },
      { id: "scheduler",  label: "Cloud Scheduler",   icon: Clock },
    ],
  },
  {
    label: "Operations",
    items: [
      { id: "monitoring", label: "Cloud Monitoring", icon: Bell },
      { id: "logs",       label: "Activity Log",     icon: ScrollText },
      { id: "community",  label: "Community",        icon: Megaphone },
    ],
  },
];

export function Sidebar() {
  const page = useStore((s) => s.page);
  const setPage = useStore((s) => s.setPage);
  const collapsed = useStore((s) => s.sidebarCollapsed);
  const logout = useStore((s) => s.logout);
  const user = useStore((s) => s.user);
  const plan = useStore((s) => s.plan);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  const toggleGroup = (label: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      next.has(label) ? next.delete(label) : next.add(label);
      return next;
    });
  };

  return (
    <aside className={`${collapsed ? "w-16" : "w-56"} bg-white border-r border-gcp-border flex flex-col shrink-0 transition-all duration-200`}>
      <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
        {NAV_GROUPS.map(group => (
          <div key={group.label}>
            {!collapsed && (
              <button
                onClick={() => toggleGroup(group.label)}
                className="w-full flex items-center justify-between px-3 py-1 text-[10px] font-semibold text-gcp-muted uppercase tracking-wider hover:text-gcp-text mt-2"
              >
                {group.label}
                {collapsedGroups.has(group.label) ? <ChevronRight className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>
            )}
            {!collapsedGroups.has(group.label) && group.items.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setPage(id)}
                className={`sidebar-item w-full ${page === id ? "active" : ""}`}
                title={collapsed ? label : undefined}
              >
                <Icon style={{ width: 18, height: 18 }} className="shrink-0" />
                {!collapsed && <span className="text-xs">{label}</span>}
              </button>
            ))}
          </div>
        ))}
      </nav>

      <div className="border-t border-gcp-border p-2 space-y-1">
        {!collapsed && user && (
          <div className="px-3 py-2">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 bg-gcp-blue rounded-full flex items-center justify-center">
                <User className="w-3.5 h-3.5 text-white" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium truncate">{user.name}</p>
                <p className="text-[10px] text-gcp-muted truncate">{user.email}</p>
              </div>
            </div>
            <div className="mt-1">
              <span className="badge bg-blue-50 text-gcp-blue capitalize">{plan}</span>
            </div>
          </div>
        )}
        <button onClick={() => logout()} className="sidebar-item w-full text-gcp-red hover:bg-red-50 hover:text-gcp-red" title={collapsed ? "Sign out" : undefined}>
          <LogOut className="w-4 h-4 shrink-0" />
          {!collapsed && <span className="text-xs">Sign Out</span>}
        </button>
      </div>
    </aside>
  );
}
