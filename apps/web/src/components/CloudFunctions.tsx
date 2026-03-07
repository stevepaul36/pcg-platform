"use client";
import { useState, useEffect } from "react";
import { useStore } from "../store";
import { Functions as FnApi, formatApiError } from "../lib/apiClient";
import { Zap, Plus, Trash2 } from "lucide-react";

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: "bg-green-100 text-green-700",
  DEPLOYING: "bg-yellow-100 text-yellow-700",
  OFFLINE: "bg-gray-100 text-gray-600",
  FAILED: "bg-red-100 text-red-700",
};

const RUNTIMES = ["nodejs20", "python311", "go121", "java17", "ruby32"];
const REGIONS = ["us-central1", "us-east1", "europe-west1", "asia-east1", "australia-southeast1"];

export function CloudFunctions() {
  const projectId = useStore(s => s.projectId);
  const addToast = useStore(s => s.addToast);
  const [fns, setFns] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: "", runtime: "nodejs20", region: "us-central1", entryPoint: "helloWorld", trigger: "HTTP", memoryMb: 256, timeoutSec: 60 });

  const load = async () => {
    if (!projectId) return;
    setLoading(true);
    try { setFns((await FnApi.list(projectId)) as any[]); }
    catch (e: any) { addToast(formatApiError(e), "error"); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [projectId]);

  const create = async () => {
    if (!projectId || !form.name) return;
    try {
      const fn = await FnApi.create(projectId, form);
      setFns(p => [fn, ...p]);
      setShowCreate(false);
      setForm({ name: "", runtime: "nodejs20", region: "us-central1", entryPoint: "helloWorld", trigger: "HTTP", memoryMb: 256, timeoutSec: 60 });
      addToast(`Function ${form.name} deploying...`, "info");
      setTimeout(load, 4000);
    } catch (e: any) { addToast(formatApiError(e), "error"); }
  };

  const deleteFn = async (fn: any) => {
    if (!projectId) return;
    try {
      await FnApi.delete(projectId, fn.id);
      setFns(p => p.filter(f => f.id !== fn.id));
      addToast(`Function ${fn.name} deleted`, "success");
    } catch (e: any) { addToast(formatApiError(e), "error"); }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-medium">Cloud Functions</h1>
          <p className="text-sm text-gcp-muted mt-0.5">Serverless event-driven functions</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> Create Function
        </button>
      </div>

      {showCreate && (
        <div className="card p-4 mb-4 border-blue-200 bg-blue-50">
          <h3 className="font-medium mb-3">New Cloud Function</h3>
          <div className="grid grid-cols-3 gap-3 mb-3">
            <div>
              <label className="text-xs text-gcp-muted block mb-1">Name *</label>
              <input className="input w-full" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="my-function" />
                <p className="text-xs text-gcp-muted mt-0.5">Lowercase letters, digits, hyphens (e.g. my-function)</p>
            </div>
            <div>
              <label className="text-xs text-gcp-muted block mb-1">Runtime</label>
              <select className="input w-full" value={form.runtime} onChange={e => setForm(f => ({ ...f, runtime: e.target.value }))}>
                {RUNTIMES.map(r => <option key={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gcp-muted block mb-1">Region</label>
              <select className="input w-full" value={form.region} onChange={e => setForm(f => ({ ...f, region: e.target.value }))}>
                {REGIONS.map(r => <option key={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gcp-muted block mb-1">Entry Point</label>
              <input className="input w-full" value={form.entryPoint} onChange={e => setForm(f => ({ ...f, entryPoint: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs text-gcp-muted block mb-1">Trigger</label>
              <select className="input w-full" value={form.trigger} onChange={e => setForm(f => ({ ...f, trigger: e.target.value }))}>
                <option>HTTP</option><option>PUBSUB</option><option>STORAGE</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-gcp-muted block mb-1">Memory (MB)</label>
              <select className="input w-full" value={form.memoryMb} onChange={e => setForm(f => ({ ...f, memoryMb: +e.target.value }))}>
                {[128, 256, 512, 1024, 2048, 4096].map(m => <option key={m}>{m}</option>)}
              </select>
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
      ) : fns.length === 0 ? (
        <div className="card p-12 text-center">
          <Zap className="w-10 h-10 text-gcp-muted mx-auto mb-3" />
          <p className="text-gcp-muted">No functions yet. Create one to run serverless code.</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                {["Name", "Runtime", "Trigger", "Region", "Memory", "Status", "Invocations", ""].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left text-xs font-medium text-gcp-muted">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gcp-border">
              {fns.map(fn => (
                <tr key={fn.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{fn.name}</td>
                  <td className="px-4 py-3 text-gcp-muted">{fn.runtime}</td>
                  <td className="px-4 py-3"><span className="badge">{fn.trigger}</span></td>
                  <td className="px-4 py-3 text-gcp-muted">{fn.region}</td>
                  <td className="px-4 py-3 text-gcp-muted">{fn.memoryMb}MB</td>
                  <td className="px-4 py-3">
                    <span className={`badge ${STATUS_COLORS[fn.status] || ""}`}>{fn.status}</span>
                  </td>
                  <td className="px-4 py-3 text-gcp-muted">{fn.invocations.toLocaleString()}</td>
                  <td className="px-4 py-3">
                    <button onClick={() => deleteFn(fn)} className="btn-icon text-gcp-red hover:bg-red-50">
                      <Trash2 className="w-4 h-4" />
                    </button>
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
