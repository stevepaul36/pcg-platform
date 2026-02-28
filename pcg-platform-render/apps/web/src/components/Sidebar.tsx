"use client";

import { useStore } from "../store";
import {
  LayoutDashboard, Server, HardDrive, Database, Shield,
  ScrollText, Megaphone, LogOut, Settings, User
} from "lucide-react";

const NAV_ITEMS = [
  { id: "dashboard", label: "Dashboard",      icon: LayoutDashboard },
  { id: "compute",   label: "Compute Engine", icon: Server },
  { id: "storage",   label: "Cloud Storage",  icon: HardDrive },
  { id: "sql",       label: "Cloud SQL",      icon: Database },
  { id: "iam",       label: "IAM & Admin",    icon: Shield },
  { id: "logs",      label: "Activity Log",   icon: ScrollText },
  { id: "community", label: "Community",       icon: Megaphone },
];

export function Sidebar() {
  const page = useStore((s) => s.page);
  const setPage = useStore((s) => s.setPage);
  const collapsed = useStore((s) => s.sidebarCollapsed);
  const logout = useStore((s) => s.logout);
  const user = useStore((s) => s.user);
  const plan = useStore((s) => s.plan);

  return (
    <aside className={`${collapsed ? "w-16" : "w-56"} bg-white border-r border-gcp-border flex flex-col shrink-0 transition-all duration-200`}>
      <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
        {NAV_ITEMS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setPage(id)}
            className={`sidebar-item w-full ${page === id ? "active" : ""}`}
            title={collapsed ? label : undefined}
          >
            <Icon className="w-4.5 h-4.5 shrink-0" style={{ width: 18, height: 18 }} />
            {!collapsed && <span>{label}</span>}
          </button>
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
          {!collapsed && <span>Sign Out</span>}
        </button>
      </div>
    </aside>
  );
}
