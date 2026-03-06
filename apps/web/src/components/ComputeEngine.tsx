"use client";

import { useState } from "react";
import { useStore } from "../store";
import { MACHINE_TYPES, ZONES, REGIONS, OS_IMAGES } from "@pcg/shared";
import {
  Server, Plus, Play, Square, Pause, Trash2, Cpu, MemoryStick,
  Globe, Clock, X, Loader2
} from "lucide-react";

export function ComputeEngine() {
  const vms = useStore((s) => s.vms);
  const loading = useStore((s) => s.loading.vms);
  const [showCreate, setShowCreate] = useState(false);

  return (
    <div className="space-y-4 max-w-6xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Compute Engine</h1>
          <p className="text-sm text-gcp-muted mt-1">Manage virtual machine instances</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> Create Instance
        </button>
      </div>

      {loading && vms.length === 0 ? (
        <div className="card p-12 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-gcp-blue" /></div>
      ) : vms.length === 0 ? (
        <div className="card p-12 text-center">
          <Server className="w-10 h-10 text-gcp-muted mx-auto mb-3" />
          <p className="text-sm text-gcp-muted">No VM instances. Create one to get started.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {vms.map((vm) => <VMCard key={vm.id} vm={vm} />)}
        </div>
      )}

      {showCreate && <CreateVMModal onClose={() => setShowCreate(false)} />}
    </div>
  );
}

function VMCard({ vm }: { vm: any }) {
  const vmAction = useStore((s) => s.vmAction);
  const deleteVM = useStore((s) => s.deleteVM);
  const addToast = useStore((s) => s.addToast);
  const [acting, setActing] = useState("");

  const handleAction = async (action: string) => {
    setActing(action);
    try {
      await vmAction(vm.id, action as any);
      addToast(`VM ${action}${action === "stop" ? "p" : ""}ed`, "success");
    } catch (err: any) {
      addToast(err.message, "error");
    } finally {
      setActing("");
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Permanently delete "${vm.name}"?`)) return;
    try {
      await deleteVM(vm.id);
      addToast("VM deleted", "success");
    } catch (err: any) {
      addToast(err.message, "error");
    }
  };

  return (
    <div className="card">
      <div className="p-5 flex items-start justify-between gap-4">
        <div className="flex items-start gap-4 min-w-0">
          <div className="mt-1"><StatusDot status={vm.status} /></div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-medium text-sm">{vm.name}</h3>
              <StatusBadge status={vm.status} />
            </div>
            <p className="text-xs text-gcp-muted mt-0.5">
              {vm.machineType} · {vm.zone} · {vm.osImage}
            </p>
            <div className="flex items-center gap-4 mt-2 text-xs text-gcp-muted">
              <span className="flex items-center gap-1"><Cpu className="w-3 h-3" /> {vm.vcpus} vCPU</span>
              <span className="flex items-center gap-1"><MemoryStick className="w-3 h-3" /> {vm.ramGb}GB RAM</span>
              <span className="flex items-center gap-1"><Globe className="w-3 h-3" /> {vm.externalIp}</span>
              <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> ${vm.hourlyCost.toFixed(4)}/hr</span>
            </div>
            {vm.status === "RUNNING" && (
              <div className="flex items-center gap-6 mt-3">
                <MiniBar label="CPU" value={vm.cpuUsage} />
                <MiniBar label="RAM" value={vm.ramUsage} />
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {(vm.status === "STOPPED" || vm.status === "SUSPENDED") && (
            <button onClick={() => handleAction("start")} disabled={!!acting} className="btn-icon" title="Start">
              <Play className="w-4 h-4 text-gcp-green" />
            </button>
          )}
          {vm.status === "RUNNING" && (
            <>
              <button onClick={() => handleAction("stop")} disabled={!!acting} className="btn-icon" title="Stop">
                <Square className="w-4 h-4 text-gcp-yellow" />
              </button>
              <button onClick={() => handleAction("suspend")} disabled={!!acting} className="btn-icon" title="Suspend">
                <Pause className="w-4 h-4 text-gcp-muted" />
              </button>
            </>
          )}
          {["RUNNING", "STOPPED", "SUSPENDED", "FAILED"].includes(vm.status) && (
            <button onClick={() => handleAction("terminate")} disabled={!!acting} className="btn-icon" title="Terminate">
              <X className="w-4 h-4 text-gcp-red" />
            </button>
          )}
          {vm.status === "TERMINATED" && (
            <button onClick={handleDelete} className="btn-icon" title="Delete">
              <Trash2 className="w-4 h-4 text-gcp-red" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function CreateVMModal({ onClose }: { onClose: () => void }) {
  const createVM = useStore((s) => s.createVM);
  const addToast = useStore((s) => s.addToast);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: "", zone: ZONES[0], region: REGIONS[0],
    machineType: MACHINE_TYPES[0], diskGb: 50,
    diskType: "pd-balanced" as string, osImage: OS_IMAGES[0],
    preemptible: false, tags: [] as string[],
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await createVM(form);
      addToast(`VM "${form.name}" created`, "success");
      onClose();
    } catch (err: any) {
      addToast(err.message, "error");
    } finally {
      setLoading(false);
    }
  };

  const set = (key: string, val: any) => setForm((f) => ({ ...f, [key]: val }));

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="p-6 border-b border-gcp-border flex items-center justify-between">
          <h2 className="text-lg font-semibold">Create VM Instance</h2>
          <button onClick={onClose} className="btn-icon"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Instance name</label>
            <input className="input-field" value={form.name} onChange={(e) => set("name", e.target.value)}
              placeholder="my-instance" required pattern="^[a-z][a-z0-9-]{0,61}[a-z0-9]$" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Region</label>
              <select className="select-field" value={form.region} onChange={(e) => set("region", e.target.value)}>
                {REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Zone</label>
              <select className="select-field" value={form.zone} onChange={(e) => set("zone", e.target.value)}>
                {ZONES.filter((z) => z.startsWith(form.region)).map((z) => <option key={z} value={z}>{z}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Machine type</label>
            <select className="select-field" value={form.machineType} onChange={(e) => set("machineType", e.target.value)}>
              {MACHINE_TYPES.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Boot disk (GB)</label>
              <input type="number" className="input-field" value={form.diskGb}
                onChange={(e) => set("diskGb", parseInt(e.target.value) || 10)} min={10} max={65536} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Disk type</label>
              <select className="select-field" value={form.diskType} onChange={(e) => set("diskType", e.target.value)}>
                <option value="pd-standard">Standard</option>
                <option value="pd-balanced">Balanced</option>
                <option value="pd-ssd">SSD</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">OS Image</label>
            <select className="select-field" value={form.osImage} onChange={(e) => set("osImage", e.target.value)}>
              {OS_IMAGES.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.preemptible} onChange={(e) => set("preemptible", e.target.checked)} className="rounded" />
            Preemptible (cheaper, may be interrupted)
          </label>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? "Creating..." : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    RUNNING:      "bg-green-50 text-gcp-green",
    PROVISIONING: "bg-blue-50 text-gcp-blue",
    STOPPING:     "bg-yellow-50 text-yellow-700",
    STOPPED:      "bg-gray-100 text-gcp-muted",
    SUSPENDED:    "bg-purple-50 text-purple-600",
    TERMINATED:   "bg-red-50 text-gcp-red",
    FAILED:       "bg-red-50 text-gcp-red",
  };
  return <span className={`badge ${styles[status] || "bg-gray-100 text-gray-600"}`}>{status}</span>;
}

function StatusDot({ status }: { status: string }) {
  const cls = status === "RUNNING" ? "bg-gcp-green" :
    status === "PROVISIONING" ? "bg-gcp-blue animate-pulse" :
    status === "FAILED" ? "bg-gcp-red" : "bg-gray-300";
  return <div className={`w-2.5 h-2.5 rounded-full ${cls}`} />;
}

function MiniBar({ label, value }: { label: string; value: number }) {
  const warn = value > 80;
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="text-gcp-muted w-8">{label}</span>
      <div className="w-20 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${warn ? "bg-gcp-red" : "bg-gcp-blue"}`} style={{ width: `${Math.min(value, 100)}%` }} />
      </div>
      <span className={`font-mono w-10 text-right ${warn ? "text-gcp-red" : ""}`}>{value.toFixed(0)}%</span>
    </div>
  );
}

export { StatusBadge };
