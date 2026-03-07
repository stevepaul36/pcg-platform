"use client";
import { useState, useEffect } from "react";
import { useStore } from "../store";
import { GKE as GKEApi, formatApiError } from "../lib/apiClient";
import { Container, Plus, Trash2 } from "lucide-react";

const STATUS_COLORS: Record<string, string> = {
  RUNNING: "bg-green-100 text-green-700",
  PROVISIONING: "bg-yellow-100 text-yellow-700",
  RECONCILING: "bg-blue-100 text-blue-700",
  STOPPING: "bg-orange-100 text-orange-700",
  ERROR: "bg-red-100 text-red-700",
};

const ZONES = ["us-central1-a", "us-central1-b", "us-east1-b", "europe-west1-b", "asia-east1-a"];
const MACHINE_TYPES = ["e2-medium", "e2-standard-2", "e2-standard-4", "n1-standard-2", "n1-standard-4", "n2-standard-2"];

export function GKEPanel() {
  const projectId = useStore(s => s.projectId);
  const addToast = useStore(s => s.addToast);
  const [clusters, setClusters] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: "", zone: "us-central1-a", nodeCount: 3, machineType: "e2-medium", diskGb: 100 });

  const load = async () => {
    if (!projectId) return;
    setLoading(true);
    try { setClusters((await GKEApi.list(projectId)) as any[]); }
    catch (e: any) { addToast(formatApiError(e), "error"); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [projectId]);

  const create = async () => {
    if (!projectId || !form.name) return;
    try {
      const c = await GKEApi.create(projectId, form);
      setClusters(p => [c, ...p]);
      setShowCreate(false);
      setForm({ name: "", zone: "us-central1-a", nodeCount: 3, machineType: "e2-medium", diskGb: 100 });
      addToast(`Cluster ${form.name} provisioning...`, "info");
      setTimeout(load, 6000);
    } catch (e: any) { addToast(formatApiError(e), "error"); }
  };

  const deleteCluster = async (c: any) => {
    if (!projectId) return;
    try {
      await GKEApi.delete(projectId, c.id);
      setClusters(p => p.map(x => x.id === c.id ? { ...x, status: "STOPPING" } : x));
      addToast(`Cluster ${c.name} deleting...`, "info");
      setTimeout(() => setClusters(p => p.filter(x => x.id !== c.id)), 3500);
    } catch (e: any) { addToast(formatApiError(e), "error"); }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-medium">Kubernetes Engine</h1>
          <p className="text-sm text-gcp-muted mt-0.5">Managed Kubernetes clusters for containerized apps</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> Create Cluster
        </button>
      </div>

      {showCreate && (
        <div className="card p-4 mb-4 border-blue-200 bg-blue-50">
          <h3 className="font-medium mb-3">New GKE Cluster</h3>
          <div className="grid grid-cols-3 gap-3 mb-3">
            <div><label className="text-xs text-gcp-muted block mb-1">Name *</label>
              <input className="input w-full" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="my-cluster" /></div>
                <p className="text-xs text-gcp-muted mt-0.5">Lowercase letters, digits, hyphens (e.g. my-cluster)</p>
            <div><label className="text-xs text-gcp-muted block mb-1">Zone</label>
              <select className="input w-full" value={form.zone} onChange={e => setForm(f => ({ ...f, zone: e.target.value }))}>
                {ZONES.map(z => <option key={z}>{z}</option>)}</select></div>
            <div><label className="text-xs text-gcp-muted block mb-1">Machine Type</label>
              <select className="input w-full" value={form.machineType} onChange={e => setForm(f => ({ ...f, machineType: e.target.value }))}>
                {MACHINE_TYPES.map(m => <option key={m}>{m}</option>)}</select></div>
            <div><label className="text-xs text-gcp-muted block mb-1">Nodes</label>
              <input className="input w-full" type="number" min={1} max={100} value={form.nodeCount} onChange={e => setForm(f => ({ ...f, nodeCount: +e.target.value }))} /></div>
            <div><label className="text-xs text-gcp-muted block mb-1">Disk (GB)</label>
              <input className="input w-full" type="number" min={10} value={form.diskGb} onChange={e => setForm(f => ({ ...f, diskGb: +e.target.value }))} /></div>
          </div>
          <div className="flex gap-2">
            <button onClick={create} className="btn-primary">Create</button>
            <button onClick={() => setShowCreate(false)} className="btn">Cancel</button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="card p-8 text-center text-gcp-muted">Loading...</div>
      ) : clusters.length === 0 ? (
        <div className="card p-12 text-center">
          <Container className="w-10 h-10 text-gcp-muted mx-auto mb-3" />
          <p className="text-gcp-muted">No clusters yet. Create one to run Kubernetes workloads.</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>{["Name","Zone","Version","Nodes","Machine Type","Status","Endpoint","Cost/hr",""].map(h =>
                <th key={h} className="px-4 py-2.5 text-left text-xs font-medium text-gcp-muted">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-gcp-border">
              {clusters.map(c => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{c.name}</td>
                  <td className="px-4 py-3 text-gcp-muted">{c.zone}</td>
                  <td className="px-4 py-3 text-gcp-muted">{c.version}</td>
                  <td className="px-4 py-3 text-gcp-muted">{c.nodeCount}</td>
                  <td className="px-4 py-3 text-gcp-muted">{c.machineType}</td>
                  <td className="px-4 py-3"><span className={`badge ${STATUS_COLORS[c.status] || ""}`}>{c.status}</span></td>
                  <td className="px-4 py-3 text-gcp-muted font-mono text-xs">{c.endpoint}</td>
                  <td className="px-4 py-3 text-gcp-muted">${c.hourlyCost.toFixed(3)}</td>
                  <td className="px-4 py-3">
                    <button onClick={() => deleteCluster(c)} className="btn-icon text-gcp-red hover:bg-red-50"><Trash2 className="w-4 h-4" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
