"use client";

import { useStore, useRunningVMs, useHourlyRate, useTotalSpend } from "../store";
import {
  Server, HardDrive, Database, DollarSign, Cpu, MemoryStick,
  ArrowUpRight
} from "lucide-react";

export function Dashboard() {
  const vms = useStore((s) => s.vms);
  const buckets = useStore((s) => s.buckets);
  const sqlInstances = useStore((s) => s.sqlInstances);
  const totalSpend = useTotalSpend();
  const hourlyRate = useHourlyRate();
  const runningVMs = useRunningVMs();
  const setPage = useStore((s) => s.setPage);
  const activityLogs = useStore((s) => s.activityLogs);
  const plan = useStore((s) => s.plan);
  const quota = useStore((s) => s.quota);

  const avgCpu = runningVMs.length > 0
    ? runningVMs.reduce((a, v) => a + v.cpuUsage, 0) / runningVMs.length
    : 0;
  const avgRam = runningVMs.length > 0
    ? runningVMs.reduce((a, v) => a + v.ramUsage, 0) / runningVMs.length
    : 0;

  const monthlyCost = hourlyRate * 730;

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h1 className="text-xl font-semibold">Dashboard</h1>
        <p className="text-sm text-gcp-muted mt-1">Project overview and resource utilization</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={<Server className="w-5 h-5" />}
          label="VM Instances"
          value={`${runningVMs.length} / ${vms.length}`}
          sub="running / total"
          color="blue"
          onClick={() => setPage("compute")}
        />
        <StatCard
          icon={<HardDrive className="w-5 h-5" />}
          label="Storage Buckets"
          value={String(buckets.length)}
          sub={quota ? `of ${quota.maxBuckets} allowed` : "buckets"}
          color="green"
          onClick={() => setPage("storage")}
        />
        <StatCard
          icon={<Database className="w-5 h-5" />}
          label="SQL Instances"
          value={String(sqlInstances.length)}
          sub={`${sqlInstances.filter((s) => s.status === "RUNNABLE").length} running`}
          color="purple"
          onClick={() => setPage("sql")}
        />
        <StatCard
          icon={<DollarSign className="w-5 h-5" />}
          label="Total Spend"
          value={`$${totalSpend.toFixed(4)}`}
          sub={`$${monthlyCost.toFixed(2)}/mo est.`}
          color="amber"
        />
      </div>

      {/* Metrics row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* CPU & RAM gauges */}
        <div className="card">
          <div className="card-header">
            <h3 className="text-sm font-medium">Resource Utilization</h3>
            <span className="text-xs text-gcp-muted">{runningVMs.length} running VMs</span>
          </div>
          <div className="card-body">
            {runningVMs.length === 0 ? (
              <p className="text-sm text-gcp-muted text-center py-4">No running VMs</p>
            ) : (
              <div className="space-y-4">
                <MetricBar label="Avg CPU" value={avgCpu} icon={<Cpu className="w-4 h-4" />} color="blue" />
                <MetricBar label="Avg RAM" value={avgRam} icon={<MemoryStick className="w-4 h-4" />} color="green" />
                <div className="text-xs text-gcp-muted mt-2">
                  Hourly rate: <span className="font-mono">${hourlyRate.toFixed(4)}</span>/hr
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Recent activity */}
        <div className="card">
          <div className="card-header">
            <h3 className="text-sm font-medium">Recent Activity</h3>
            <button onClick={() => setPage("logs")} className="text-xs text-gcp-blue hover:underline flex items-center gap-0.5">
              View all <ArrowUpRight className="w-3 h-3" />
            </button>
          </div>
          <div className="card-body p-0">
            {activityLogs.length === 0 ? (
              <p className="text-sm text-gcp-muted text-center py-8">No activity yet</p>
            ) : (
              <div className="divide-y divide-gcp-border">
                {activityLogs.slice(0, 6).map((log) => (
                  <div key={log.id} className="px-6 py-3 flex items-start gap-3">
                    <div className={`mt-0.5 w-2 h-2 rounded-full shrink-0 ${
                      log.severity === "ERROR" ? "bg-gcp-red" :
                      log.severity === "WARNING" ? "bg-gcp-yellow" : "bg-gcp-green"
                    }`} />
                    <div className="min-w-0">
                      <p className="text-sm truncate">{log.description}</p>
                      <p className="text-xs text-gcp-muted">
                        {new Date(log.timestamp).toLocaleString()} · {log.user}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Plan info */}
      {quota && (
        <div className="card">
          <div className="card-body flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Current Plan: <span className="text-gcp-blue capitalize">{plan}</span></p>
              <p className="text-xs text-gcp-muted mt-0.5">
                {quota.maxVMs} VMs · {quota.maxBuckets} buckets · {quota.maxSQLInstances} SQL instances
              </p>
            </div>
            <span className="badge bg-blue-50 text-gcp-blue">{quota.label}</span>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ icon, label, value, sub, color, onClick }: {
  icon: React.ReactNode; label: string; value: string; sub: string;
  color: "blue" | "green" | "purple" | "amber"; onClick?: () => void;
}) {
  const colors = {
    blue:   "bg-blue-50 text-gcp-blue",
    green:  "bg-green-50 text-gcp-green",
    purple: "bg-purple-50 text-purple-600",
    amber:  "bg-amber-50 text-amber-600",
  };

  return (
    <div className={`card p-5 ${onClick ? "cursor-pointer hover:shadow-md transition-shadow" : ""}`} onClick={onClick}>
      <div className="flex items-center gap-3 mb-3">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${colors[color]}`}>{icon}</div>
        <span className="text-sm text-gcp-muted">{label}</span>
      </div>
      <p className="text-2xl font-semibold font-mono">{value}</p>
      <p className="text-xs text-gcp-muted mt-1">{sub}</p>
    </div>
  );
}

function MetricBar({ label, value, icon, color }: {
  label: string; value: number; icon: React.ReactNode; color: "blue" | "green";
}) {
  const clr = color === "blue" ? "bg-gcp-blue" : "bg-gcp-green";
  const warn = value > 80;

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2 text-sm text-gcp-muted">{icon}{label}</div>
        <span className={`text-sm font-mono font-medium ${warn ? "text-gcp-red" : "text-gcp-text"}`}>
          {value.toFixed(1)}%
        </span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-500 ${warn ? "bg-gcp-red" : clr}`}
          style={{ width: `${Math.min(value, 100)}%` }}
        />
      </div>
    </div>
  );
}
