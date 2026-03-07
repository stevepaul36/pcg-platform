"use client";
import { useState, useEffect } from "react";
import { useStore } from "../store";
import { CloudRun as CloudRunApi, formatApiError } from "../lib/apiClient";
import { Wind, Plus, Trash2, ExternalLink } from "lucide-react";

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: "bg-green-100 text-green-700",
  DEPLOYING: "bg-yellow-100 text-yellow-700",
  FAILED: "bg-red-100 text-red-700",
};

const REGIONS = ["us-central1", "us-east1", "europe-west1", "asia-east1", "australia-southeast1"];

export function CloudRunPanel() {
  const projectId = useStore(s => s.projectId);
  const addToast = useStore(s => s.addToast);
  const [services, setServices] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: "", region: "us-central1", image: "", cpu: "1", memoryMb: 512, minInstances: 0, maxInstances: 100 });

  const load = async () => {
    if (!projectId) return;
    setLoading(true);
    try { setServices((await CloudRunApi.list(projectId)) as any[]); }
    catch (e: any) { addToast(formatApiError(e), "error"); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [projectId]);

  const create = async () => {
    if (!projectId || !form.name || !form.image) return;
    try {
      const s = await CloudRunApi.create(projectId, form);
      setServices(p => [s, ...p]);
      setShowCreate(false);
      setForm({ name: "", region: "us-central1", image: "", cpu: "1", memoryMb: 512, minInstances: 0, maxInstances: 100 });
      addToast(`Service ${form.name} deploying...`, "info");
      setTimeout(load, 4000);
    } catch (e: any) { addToast(formatApiError(e), "error"); }
  };

  const deleteSvc = async (s: any) => {
    if (!projectId) return;
    try {
      await CloudRunApi.delete(projectId, s.id);
      setServices(p => p.filter(x => x.id !== s.id));
      addToast(`Service ${s.name} deleted`, "success");
    } catch (e: any) { addToast(formatApiError(e), "error"); }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-medium">Cloud Run</h1>
          <p className="text-sm text-gcp-muted mt-0.5">Deploy and scale containerized apps</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> Deploy Service
        </button>
      </div>

      {showCreate && (
        <div className="card p-4 mb-4 border-blue-200 bg-blue-50">
          <h3 className="font-medium mb-3">New Cloud Run Service</h3>
          <div className="grid grid-cols-3 gap-3 mb-3">
            <div><label className="text-xs text-gcp-muted block mb-1">Name *</label>
              <input className="input w-full" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="my-service" /></div>
                <p className="text-xs text-gcp-muted mt-0.5">Lowercase letters, digits, hyphens (e.g. my-service)</p>
            <div><label className="text-xs text-gcp-muted block mb-1">Container Image *</label>
              <input className="input w-full" value={form.image} onChange={e => setForm(f => ({ ...f, image: e.target.value }))} placeholder="gcr.io/my-project/my-image" /></div>
            <div><label className="text-xs text-gcp-muted block mb-1">Region</label>
              <select className="input w-full" value={form.region} onChange={e => setForm(f => ({ ...f, region: e.target.value }))}>
                {REGIONS.map(r => <option key={r}>{r}</option>)}</select></div>
            <div><label className="text-xs text-gcp-muted block mb-1">CPU</label>
              <select className="input w-full" value={form.cpu} onChange={e => setForm(f => ({ ...f, cpu: e.target.value }))}>
                {["1","2","4","8"].map(c => <option key={c}>{c}</option>)}</select></div>
            <div><label className="text-xs text-gcp-muted block mb-1">Memory (MB)</label>
              <select className="input w-full" value={form.memoryMb} onChange={e => setForm(f => ({ ...f, memoryMb: +e.target.value }))}>
                {[128,256,512,1024,2048,4096,8192].map(m => <option key={m}>{m}</option>)}</select></div>
            <div className="flex gap-2">
              <div><label className="text-xs text-gcp-muted block mb-1">Min Instances</label>
                <input className="input w-full" type="number" min={0} value={form.minInstances} onChange={e => setForm(f => ({ ...f, minInstances: +e.target.value }))} /></div>
              <div><label className="text-xs text-gcp-muted block mb-1">Max Instances</label>
                <input className="input w-full" type="number" min={1} value={form.maxInstances} onChange={e => setForm(f => ({ ...f, maxInstances: +e.target.value }))} /></div>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={create} className="btn-primary">Deploy</button>
            <button onClick={() => setShowCreate(false)} className="btn">Cancel</button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="card p-8 text-center text-gcp-muted">Loading...</div>
      ) : services.length === 0 ? (
        <div className="card p-12 text-center">
          <Wind className="w-10 h-10 text-gcp-muted mx-auto mb-3" />
          <p className="text-gcp-muted">No services yet. Deploy a container to get started.</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>{["Name","Region","Image","CPU/Mem","Instances","Status","URL",""].map(h =>
                <th key={h} className="px-4 py-2.5 text-left text-xs font-medium text-gcp-muted">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-gcp-border">
              {services.map(s => (
                <tr key={s.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{s.name}</td>
                  <td className="px-4 py-3 text-gcp-muted">{s.region}</td>
                  <td className="px-4 py-3 text-gcp-muted text-xs font-mono truncate max-w-[160px]">{s.image}</td>
                  <td className="px-4 py-3 text-gcp-muted">{s.cpu} vCPU / {s.memoryMb}MB</td>
                  <td className="px-4 py-3 text-gcp-muted">{s.minInstances}–{s.maxInstances}</td>
                  <td className="px-4 py-3"><span className={`badge ${STATUS_COLORS[s.status] || ""}`}>{s.status}</span></td>
                  <td className="px-4 py-3">
                    <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-gcp-blue text-xs flex items-center gap-1 hover:underline">
                      URL <ExternalLink className="w-3 h-3" />
                    </a>
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => deleteSvc(s)} className="btn-icon text-gcp-red hover:bg-red-50"><Trash2 className="w-4 h-4" /></button>
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
