"use client";
import { useState, useEffect } from "react";
import { useStore } from "../store";
import { VertexAI as VertexApi, formatApiError } from "../lib/apiClient";
import { Brain, Plus, Trash2, Cpu } from "lucide-react";

const STATUS_COLORS: Record<string, string> = {
  DEPLOYED: "bg-green-100 text-green-700",
  UPLOADING: "bg-yellow-100 text-yellow-700",
  FAILED: "bg-red-100 text-red-700",
  DEPLOYING: "bg-blue-100 text-blue-700",
};

const FRAMEWORKS = ["TensorFlow", "PyTorch", "scikit-learn", "XGBoost"];
const REGIONS = ["us-central1", "us-east4", "europe-west4", "asia-east1"];

export function VertexAIPanel() {
  const projectId = useStore(s => s.projectId);
  const addToast = useStore(s => s.addToast);
  const [models, setModels] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: "", displayName: "", framework: "TensorFlow", region: "us-central1" });

  const load = async () => {
    if (!projectId) return;
    setLoading(true);
    try { setModels((await VertexApi.listModels(projectId)) as any[]); }
    catch (e: any) { addToast(formatApiError(e), "error"); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [projectId]);

  const create = async () => {
    if (!projectId || !form.name || !form.displayName) return;
    try {
      const m = await VertexApi.createModel(projectId, form);
      setModels(p => [m, ...p]);
      setShowCreate(false);
      setForm({ name: "", displayName: "", framework: "TensorFlow", region: "us-central1" });
      addToast(`Model ${form.displayName} uploading...`, "info");
      setTimeout(load, 5000);
    } catch (e: any) { addToast(formatApiError(e), "error"); }
  };

  const deleteModel = async (m: any) => {
    if (!projectId) return;
    try {
      await VertexApi.deleteModel(projectId, m.id);
      setModels(p => p.filter(x => x.id !== m.id));
      addToast(`Model ${m.name} deleted`, "success");
    } catch (e: any) { addToast(formatApiError(e), "error"); }
  };

  const deployEndpoint = async (m: any) => {
    if (!projectId) return;
    try {
      await VertexApi.createEndpoint(projectId, m.id, { name: `${m.name}-endpoint` });
      addToast(`Endpoint for ${m.name} deploying...`, "info");
      setTimeout(load, 4000);
    } catch (e: any) { addToast(formatApiError(e), "error"); }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-medium">Vertex AI</h1>
          <p className="text-sm text-gcp-muted mt-0.5">Train, deploy, and manage ML models</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> Upload Model
        </button>
      </div>

      {showCreate && (
        <div className="card p-4 mb-4 border-blue-200 bg-blue-50">
          <h3 className="font-medium mb-3">Upload Model to Vertex AI</h3>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div><label className="text-xs text-gcp-muted block mb-1">Model ID *</label>
              <input className="input w-full" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="my-model" /></div>
                <p className="text-xs text-gcp-muted mt-0.5">Letters, digits, hyphens, underscores (e.g. my-model)</p>
            <div><label className="text-xs text-gcp-muted block mb-1">Display Name *</label>
              <input className="input w-full" value={form.displayName} onChange={e => setForm(f => ({ ...f, displayName: e.target.value }))} placeholder="My Model v1" /></div>
            <div><label className="text-xs text-gcp-muted block mb-1">Framework</label>
              <select className="input w-full" value={form.framework} onChange={e => setForm(f => ({ ...f, framework: e.target.value }))}>
                {FRAMEWORKS.map(fw => <option key={fw}>{fw}</option>)}</select></div>
            <div><label className="text-xs text-gcp-muted block mb-1">Region</label>
              <select className="input w-full" value={form.region} onChange={e => setForm(f => ({ ...f, region: e.target.value }))}>
                {REGIONS.map(r => <option key={r}>{r}</option>)}</select></div>
          </div>
          <div className="flex gap-2">
            <button onClick={create} className="btn-primary">Upload & Deploy</button>
            <button onClick={() => setShowCreate(false)} className="btn">Cancel</button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="card p-8 text-center text-gcp-muted">Loading models...</div>
      ) : models.length === 0 ? (
        <div className="card p-12 text-center">
          <Brain className="w-10 h-10 text-gcp-muted mx-auto mb-3" />
          <p className="text-gcp-muted">No models yet. Upload one to get started with ML.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {models.map(m => (
            <div key={m.id} className="card p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <Brain className="w-4 h-4 text-gcp-blue" />
                  <div>
                    <span className="font-medium">{m.displayName}</span>
                    <span className="text-xs text-gcp-muted ml-2">{m.name} · v{m.versionId}</span>
                  </div>
                  <span className={`badge ${STATUS_COLORS[m.status] || ""}`}>{m.status}</span>
                  <span className="badge">{m.framework}</span>
                  <span className="text-xs text-gcp-muted">{m.region}</span>
                </div>
                <div className="flex items-center gap-2">
                  {m.status === "DEPLOYED" && (
                    <button onClick={() => deployEndpoint(m)} className="btn text-xs flex items-center gap-1">
                      <Cpu className="w-3 h-3" /> Deploy Endpoint
                    </button>
                  )}
                  <button onClick={() => deleteModel(m)} className="btn-icon text-gcp-red hover:bg-red-50"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
              {(m.endpoints || []).length > 0 && (
                <div className="mt-2 border-t pt-2">
                  <p className="text-xs text-gcp-muted mb-1">Endpoints:</p>
                  {m.endpoints.map((ep: any) => (
                    <div key={ep.id} className="flex items-center gap-3 text-xs py-1">
                      <span className="font-medium">{ep.name}</span>
                      <span className={`badge ${STATUS_COLORS[ep.status] || ""}`}>{ep.status}</span>
                      <span className="text-gcp-muted">{ep.region}</span>
                      <span className="text-gcp-muted">${ep.hourlyCost.toFixed(2)}/hr</span>
                      <span className="text-gcp-muted">{ep.requestCount.toLocaleString()} requests</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
