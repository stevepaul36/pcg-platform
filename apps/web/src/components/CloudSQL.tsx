"use client";

import { useState } from "react";
import { useStore } from "../store";
import { REGIONS, SQL_TIERS, DB_VERSIONS } from "@pcg/shared";
import { Database, Plus, Trash2, X, Loader2 } from "lucide-react";

export function CloudSQL() {
  const instances = useStore((s) => s.sqlInstances);
  const loading = useStore((s) => s.loading.sql);
  const [showCreate, setShowCreate] = useState(false);

  return (
    <div className="space-y-4 max-w-6xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Cloud SQL</h1>
          <p className="text-sm text-gcp-muted mt-1">Managed database instances</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> Create Instance
        </button>
      </div>

      {loading && instances.length === 0 ? (
        <div className="card p-12 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-gcp-blue" /></div>
      ) : instances.length === 0 ? (
        <div className="card p-12 text-center">
          <Database className="w-10 h-10 text-gcp-muted mx-auto mb-3" />
          <p className="text-sm text-gcp-muted">No SQL instances. Create one to get started.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {instances.map((inst) => (
            <SQLCard key={inst.id} instance={inst} />
          ))}
        </div>
      )}
      {showCreate && <CreateSQLModal onClose={() => setShowCreate(false)} />}
    </div>
  );
}

function SQLCard({ instance }: { instance: any }) {
  const deleteSQL = useStore((s) => s.deleteSQL);
  const addToast = useStore((s) => s.addToast);

  const handleDelete = async () => {
    if (!confirm(`Delete SQL instance "${instance.name}"?`)) return;
    try { await deleteSQL(instance.id); addToast("Instance deleted", "success"); }
    catch (err: any) { addToast(err.message, "error"); }
  };

  const statusCls = instance.status === "RUNNABLE" ? "bg-green-50 text-gcp-green" :
    instance.status === "PENDING_CREATE" ? "bg-blue-50 text-gcp-blue" : "bg-red-50 text-gcp-red";

  return (
    <div className="card p-5 flex items-start justify-between">
      <div className="flex items-start gap-3">
        <Database className="w-5 h-5 text-purple-500 mt-0.5" />
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-medium text-sm">{instance.name}</h3>
            <span className={`badge ${statusCls}`}>{instance.status}</span>
          </div>
          <p className="text-xs text-gcp-muted mt-0.5">
            {instance.dbType} {instance.dbVersion} · {instance.tier} · {instance.region}
          </p>
          <p className="text-xs text-gcp-muted">
            {instance.storageGb}GB · {instance.highAvailability ? "HA" : "Single zone"}
            {instance.backups ? " · Backups on" : ""} · ${instance.hourlyCost.toFixed(4)}/hr
          </p>
          <p className="text-xs text-gcp-muted font-mono mt-1">Connection: {instance.connectionName}</p>
        </div>
      </div>
      <button onClick={handleDelete} className="btn-icon"><Trash2 className="w-4 h-4 text-gcp-red" /></button>
    </div>
  );
}

function CreateSQLModal({ onClose }: { onClose: () => void }) {
  const createSQL = useStore((s) => s.createSQL);
  const addToast = useStore((s) => s.addToast);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: "", dbType: "PostgreSQL" as string, dbVersion: "POSTGRES_16",
    tier: SQL_TIERS[0], region: REGIONS[0], storageGb: 10,
    highAvailability: false, backups: true,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true);
    try { await createSQL(form); addToast(`SQL instance "${form.name}" created`, "success"); onClose(); }
    catch (err: any) { addToast(err.message, "error"); }
    finally { setLoading(false); }
  };

  const versions = DB_VERSIONS[form.dbType] || [];

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="p-6 border-b border-gcp-border flex items-center justify-between">
          <h2 className="text-lg font-semibold">Create SQL Instance</h2>
          <button onClick={onClose} className="btn-icon"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Instance name</label>
            <input className="input-field" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="my-database" required />
              <p className="text-xs text-gcp-muted mt-0.5">Lowercase letters, digits, hyphens (e.g. my-database)</p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Database type</label>
              <select className="select-field" value={form.dbType} onChange={(e) => {
                const dbType = e.target.value;
                setForm({ ...form, dbType, dbVersion: DB_VERSIONS[dbType]?.[0] || "" });
              }}>
                {Object.keys(DB_VERSIONS).map((t) => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Version</label>
              <select className="select-field" value={form.dbVersion} onChange={(e) => setForm({ ...form, dbVersion: e.target.value })}>
                {versions.map((v: string) => <option key={v}>{v}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Tier</label>
              <select className="select-field" value={form.tier} onChange={(e) => setForm({ ...form, tier: e.target.value })}>
                {SQL_TIERS.map((t) => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Region</label>
              <select className="select-field" value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })}>
                {REGIONS.map((r) => <option key={r}>{r}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Storage (GB)</label>
            <input type="number" className="input-field" value={form.storageGb}
              onChange={(e) => setForm({ ...form, storageGb: parseInt(e.target.value) || 10 })} min={10} max={65536} />
          </div>
          <div className="flex gap-6">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.highAvailability} onChange={(e) => setForm({ ...form, highAvailability: e.target.checked })} />
              High Availability
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.backups} onChange={(e) => setForm({ ...form, backups: e.target.checked })} />
              Automated Backups
            </label>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
            <button type="submit" className="btn-primary" disabled={loading}>{loading ? "Creating..." : "Create"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
