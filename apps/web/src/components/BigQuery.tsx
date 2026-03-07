"use client";
import { useState, useEffect } from "react";
import { useStore } from "../store";
import { BigQuery as BQApi, formatApiError } from "../lib/apiClient";
import { Database, Plus, Trash2, Table2, ChevronRight, ChevronDown } from "lucide-react";

export function BigQueryPanel() {
  const projectId = useStore(s => s.projectId);
  const addToast = useStore(s => s.addToast);

  const [datasets, setDatasets] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [showCreate, setShowCreate] = useState(false);
  const [showCreateTable, setShowCreateTable] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", location: "US", description: "" });
  const [tableForm, setTableForm] = useState({ name: "", tableType: "TABLE" });

  const load = async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const data = await BQApi.list(projectId);
      setDatasets(data as any[]);
    } catch (e: any) { addToast(formatApiError(e), "error"); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [projectId]);

  const handleCreateDataset = async () => {
    if (!projectId || !form.name) return;
    try {
      const ds = await BQApi.createDataset(projectId, form);
      setDatasets(prev => [{ ...ds, tables: [] }, ...prev]);
      setShowCreate(false);
      setForm({ name: "", location: "US", description: "" });
      addToast(`Dataset ${form.name} created`, "success");
    } catch (e: any) { addToast(formatApiError(e), "error"); }
  };

  const handleDeleteDataset = async (ds: any) => {
    if (!projectId) return;
    try {
      await BQApi.deleteDataset(projectId, ds.id);
      setDatasets(prev => prev.filter(d => d.id !== ds.id));
      addToast(`Dataset ${ds.name} deleted`, "success");
    } catch (e: any) { addToast(formatApiError(e), "error"); }
  };

  const handleCreateTable = async (datasetId: string) => {
    if (!projectId || !tableForm.name) return;
    try {
      const tbl = await BQApi.createTable(projectId, datasetId, tableForm);
      setDatasets(prev => prev.map(d => d.id === datasetId ? { ...d, tables: [...(d.tables || []), tbl] } : d));
      setShowCreateTable(null);
      setTableForm({ name: "", tableType: "TABLE" });
      addToast(`Table ${tableForm.name} created`, "success");
    } catch (e: any) { addToast(formatApiError(e), "error"); }
  };

  const handleDeleteTable = async (datasetId: string, tableId: string, tableName: string) => {
    if (!projectId) return;
    try {
      await BQApi.deleteTable(projectId, tableId);
      setDatasets(prev => prev.map(d => d.id === datasetId ? { ...d, tables: d.tables.filter((t: any) => t.id !== tableId) } : d));
      addToast(`Table ${tableName} deleted`, "success");
    } catch (e: any) { addToast(formatApiError(e), "error"); }
  };

  const LOCATIONS = ["US", "EU", "us-central1", "europe-west1", "asia-east1"];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-medium">BigQuery</h1>
          <p className="text-sm text-gcp-muted mt-0.5">Serverless data warehouse and analytics</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> Create Dataset
        </button>
      </div>

      {showCreate && (
        <div className="card p-4 mb-4 border-blue-200 bg-blue-50">
          <h3 className="font-medium mb-3">New Dataset</h3>
          <div className="grid grid-cols-3 gap-3 mb-3">
            <div>
              <label className="text-xs text-gcp-muted block mb-1">Dataset ID *</label>
              <input className="input w-full" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="my_dataset" />
                <p className="text-xs text-gcp-muted mt-0.5">Letters, digits, underscores only — no hyphens (e.g. my_dataset)</p>
            </div>
            <div>
              <label className="text-xs text-gcp-muted block mb-1">Location</label>
              <select className="input w-full" value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))}>
                {LOCATIONS.map(l => <option key={l}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gcp-muted block mb-1">Description</label>
              <input className="input w-full" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Optional" />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={handleCreateDataset} className="btn-primary">Create</button>
            <button onClick={() => setShowCreate(false)} className="btn">Cancel</button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="card p-8 text-center text-gcp-muted">Loading datasets...</div>
      ) : datasets.length === 0 ? (
        <div className="card p-12 text-center">
          <Database className="w-10 h-10 text-gcp-muted mx-auto mb-3" />
          <p className="text-gcp-muted">No datasets yet. Create one to start analyzing data.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {datasets.map(ds => (
            <div key={ds.id} className="card">
              <div
                className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50"
                onClick={() => setExpanded(prev => {
                  const next = new Set(prev);
                  next.has(ds.id) ? next.delete(ds.id) : next.add(ds.id);
                  return next;
                })}
              >
                <div className="flex items-center gap-3">
                  {expanded.has(ds.id) ? <ChevronDown className="w-4 h-4 text-gcp-muted" /> : <ChevronRight className="w-4 h-4 text-gcp-muted" />}
                  <Database className="w-4 h-4 text-gcp-blue" />
                  <div>
                    <span className="font-medium text-sm">{ds.name}</span>
                    <span className="ml-3 text-xs text-gcp-muted">{ds.location} · {ds.tables?.length || 0} tables</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={e => { e.stopPropagation(); setShowCreateTable(ds.id); }}
                    className="btn text-xs flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" /> Table
                  </button>
                  <button onClick={e => { e.stopPropagation(); handleDeleteDataset(ds); }} className="btn-icon text-gcp-red hover:bg-red-50">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {showCreateTable === ds.id && (
                <div className="px-4 pb-4 border-t bg-gray-50">
                  <div className="pt-3 flex gap-3 items-end">
                    <div>
                      <label className="text-xs text-gcp-muted block mb-1">Table ID *</label>
                      <input className="input" value={tableForm.name} onChange={e => setTableForm(f => ({ ...f, name: e.target.value }))} placeholder="my_table" />
                    </div>
                    <div>
                      <label className="text-xs text-gcp-muted block mb-1">Type</label>
                      <select className="input" value={tableForm.tableType} onChange={e => setTableForm(f => ({ ...f, tableType: e.target.value }))}>
                        <option>TABLE</option><option>VIEW</option><option>EXTERNAL</option>
                      </select>
                    </div>
                    <button onClick={() => handleCreateTable(ds.id)} className="btn-primary">Create</button>
                    <button onClick={() => setShowCreateTable(null)} className="btn">Cancel</button>
                  </div>
                </div>
              )}

              {expanded.has(ds.id) && (
                <div className="border-t">
                  {(ds.tables || []).length === 0 ? (
                    <p className="text-sm text-gcp-muted px-12 py-3">No tables in this dataset</p>
                  ) : (
                    ds.tables.map((tbl: any) => (
                      <div key={tbl.id} className="flex items-center justify-between px-12 py-2 hover:bg-gray-50 border-b last:border-0">
                        <div className="flex items-center gap-2">
                          <Table2 className="w-3.5 h-3.5 text-gcp-muted" />
                          <span className="text-sm">{tbl.name}</span>
                          <span className="badge">{tbl.tableType}</span>
                          <span className="text-xs text-gcp-muted">{Number(tbl.rowCount).toLocaleString()} rows</span>
                        </div>
                        <button onClick={() => handleDeleteTable(ds.id, tbl.id, tbl.name)} className="btn-icon text-gcp-red hover:bg-red-50">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
