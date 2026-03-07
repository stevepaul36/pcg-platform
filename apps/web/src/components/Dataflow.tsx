"use client";
import { useState, useEffect } from "react";
import { useStore } from "../store";
import { Dataflow as DataflowApi, formatApiError } from "../lib/apiClient";
import { GitBranch, Plus, Trash2, StopCircle } from "lucide-react";

const STATUS_COLORS: Record<string, string> = {
  JOB_STATE_RUNNING: "bg-green-100 text-green-700",
  JOB_STATE_DONE: "bg-blue-100 text-blue-700",
  JOB_STATE_FAILED: "bg-red-100 text-red-700",
  JOB_STATE_CANCELLED: "bg-gray-100 text-gray-600",
};

const STATUS_LABELS: Record<string, string> = {
  JOB_STATE_RUNNING: "Running",
  JOB_STATE_DONE: "Done",
  JOB_STATE_FAILED: "Failed",
  JOB_STATE_CANCELLED: "Cancelled",
};

const TEMPLATES = [
  "Pub/Sub to BigQuery",
  "Pub/Sub to Cloud Storage",
  "Cloud Storage to BigQuery",
  "Datastore to BigQuery",
  "BigQuery to Cloud Storage",
  "Word Count",
  "Streaming Beam SQL",
];

const REGIONS = ["us-central1", "us-east1", "europe-west1", "asia-east1"];

export function DataflowPanel() {
  const projectId = useStore(s => s.projectId);
  const addToast = useStore(s => s.addToast);
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: "", template: TEMPLATES[0], region: "us-central1", workers: 1, maxWorkers: 10 });

  const load = async () => {
    if (!projectId) return;
    setLoading(true);
    try { setJobs((await DataflowApi.list(projectId)) as any[]); }
    catch (e: any) { addToast(formatApiError(e), "error"); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [projectId]);

  const create = async () => {
    if (!projectId || !form.name) return;
    try {
      const j = await DataflowApi.create(projectId, form);
      setJobs(p => [j, ...p]);
      setShowCreate(false);
      setForm({ name: "", template: TEMPLATES[0], region: "us-central1", workers: 1, maxWorkers: 10 });
      addToast(`Job ${form.name} started`, "success");
    } catch (e: any) { addToast(formatApiError(e), "error"); }
  };

  const cancelJob = async (j: any) => {
    if (!projectId) return;
    try {
      const updated = await DataflowApi.cancel(projectId, j.id);
      setJobs(p => p.map(x => x.id === j.id ? { ...x, status: "JOB_STATE_CANCELLED" } : x));
      addToast(`Job ${j.name} cancelled`, "info");
    } catch (e: any) { addToast(formatApiError(e), "error"); }
  };

  const deleteJob = async (j: any) => {
    if (!projectId) return;
    try {
      await DataflowApi.delete(projectId, j.id);
      setJobs(p => p.filter(x => x.id !== j.id));
      addToast(`Job ${j.name} deleted`, "success");
    } catch (e: any) { addToast(formatApiError(e), "error"); }
  };

  const fmtBytes = (n: number) => {
    if (n >= 1e12) return `${(n / 1e12).toFixed(1)} TB`;
    if (n >= 1e9) return `${(n / 1e9).toFixed(1)} GB`;
    if (n >= 1e6) return `${(n / 1e6).toFixed(1)} MB`;
    return `${n} B`;
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-medium">Dataflow</h1>
          <p className="text-sm text-gcp-muted mt-0.5">Unified batch and stream data processing</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> Create Job
        </button>
      </div>

      {showCreate && (
        <div className="card p-4 mb-4 border-blue-200 bg-blue-50">
          <h3 className="font-medium mb-3">New Dataflow Job</h3>
          <div className="grid grid-cols-3 gap-3 mb-3">
            <div><label className="text-xs text-gcp-muted block mb-1">Job Name *</label>
              <input className="input w-full" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="my-pipeline" /></div>
                <p className="text-xs text-gcp-muted mt-0.5">Lowercase letters, digits, hyphens (e.g. my-pipeline)</p>
            <div><label className="text-xs text-gcp-muted block mb-1">Template</label>
              <select className="input w-full" value={form.template} onChange={e => setForm(f => ({ ...f, template: e.target.value }))}>
                {TEMPLATES.map(t => <option key={t}>{t}</option>)}</select></div>
            <div><label className="text-xs text-gcp-muted block mb-1">Region</label>
              <select className="input w-full" value={form.region} onChange={e => setForm(f => ({ ...f, region: e.target.value }))}>
                {REGIONS.map(r => <option key={r}>{r}</option>)}</select></div>
            <div><label className="text-xs text-gcp-muted block mb-1">Initial Workers</label>
              <input className="input w-full" type="number" min={1} value={form.workers} onChange={e => setForm(f => ({ ...f, workers: +e.target.value }))} /></div>
            <div><label className="text-xs text-gcp-muted block mb-1">Max Workers</label>
              <input className="input w-full" type="number" min={1} value={form.maxWorkers} onChange={e => setForm(f => ({ ...f, maxWorkers: +e.target.value }))} /></div>
          </div>
          <div className="flex gap-2">
            <button onClick={create} className="btn-primary">Run Job</button>
            <button onClick={() => setShowCreate(false)} className="btn">Cancel</button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="card p-8 text-center text-gcp-muted">Loading jobs...</div>
      ) : jobs.length === 0 ? (
        <div className="card p-12 text-center">
          <GitBranch className="w-10 h-10 text-gcp-muted mx-auto mb-3" />
          <p className="text-gcp-muted">No Dataflow jobs yet. Create one to process data at scale.</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>{["Job Name","Template","Region","Workers","Data Processed","Status","Cost/hr",""].map(h =>
                <th key={h} className="px-4 py-2.5 text-left text-xs font-medium text-gcp-muted">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-gcp-border">
              {jobs.map(j => (
                <tr key={j.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{j.name}</td>
                  <td className="px-4 py-3 text-gcp-muted text-xs">{j.template}</td>
                  <td className="px-4 py-3 text-gcp-muted">{j.region}</td>
                  <td className="px-4 py-3 text-gcp-muted">{j.workers}/{j.maxWorkers}</td>
                  <td className="px-4 py-3 text-gcp-muted">{fmtBytes(Number(j.bytesProcessed))}</td>
                  <td className="px-4 py-3">
                    <span className={`badge ${STATUS_COLORS[j.status] || ""}`}>{STATUS_LABELS[j.status] || j.status}</span>
                  </td>
                  <td className="px-4 py-3 text-gcp-muted">${j.hourlyCost.toFixed(3)}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      {j.status === "JOB_STATE_RUNNING" && (
                        <button onClick={() => cancelJob(j)} className="btn-icon text-orange-500 hover:bg-orange-50" title="Cancel">
                          <StopCircle className="w-4 h-4" />
                        </button>
                      )}
                      <button onClick={() => deleteJob(j)} className="btn-icon text-gcp-red hover:bg-red-50"><Trash2 className="w-4 h-4" /></button>
                    </div>
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
