"use client";

import { useState } from "react";
import { useStore } from "../store";
import { REGIONS } from "@pcg/shared";
import { HardDrive, Plus, Trash2, File, X, Loader2, FolderOpen } from "lucide-react";

export function CloudStorage() {
  const buckets = useStore((s) => s.buckets);
  const loading = useStore((s) => s.loading.buckets);
  const [showCreate, setShowCreate] = useState(false);

  return (
    <div className="space-y-4 max-w-6xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Cloud Storage</h1>
          <p className="text-sm text-gcp-muted mt-1">Manage storage buckets and objects</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> Create Bucket
        </button>
      </div>

      {loading && buckets.length === 0 ? (
        <div className="card p-12 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-gcp-blue" /></div>
      ) : buckets.length === 0 ? (
        <div className="card p-12 text-center">
          <HardDrive className="w-10 h-10 text-gcp-muted mx-auto mb-3" />
          <p className="text-sm text-gcp-muted">No storage buckets. Create one to get started.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {buckets.map((b) => <BucketCard key={b.id} bucket={b} />)}
        </div>
      )}

      {showCreate && <CreateBucketModal onClose={() => setShowCreate(false)} />}
    </div>
  );
}

function BucketCard({ bucket }: { bucket: any }) {
  const deleteBucket = useStore((s) => s.deleteBucket);
  const addToast = useStore((s) => s.addToast);
  const [expanded, setExpanded] = useState(false);

  const handleDelete = async () => {
    if (!confirm(`Delete bucket "${bucket.name}"?`)) return;
    try {
      await deleteBucket(bucket.id);
      addToast("Bucket deleted", "success");
    } catch (err: any) {
      addToast(err.message, "error");
    }
  };

  const sizeStr = formatBytes(Number(bucket.totalSizeBytes || 0));
  const objectCount = bucket.objects?.length ?? 0;

  return (
    <div className="card">
      <div className="p-5 flex items-start justify-between">
        <div className="flex items-start gap-3 min-w-0 cursor-pointer" onClick={() => setExpanded(!expanded)}>
          <FolderOpen className="w-5 h-5 text-gcp-blue mt-0.5 shrink-0" />
          <div>
            <h3 className="font-medium text-sm">{bucket.name}</h3>
            <p className="text-xs text-gcp-muted mt-0.5">
              {bucket.location} · {bucket.storageClass} · {sizeStr} · {objectCount} objects
            </p>
          </div>
        </div>
        <button onClick={handleDelete} className="btn-icon" title="Delete"><Trash2 className="w-4 h-4 text-gcp-red" /></button>
      </div>
      {expanded && objectCount > 0 && (
        <div className="border-t border-gcp-border px-5 py-3 space-y-2">
          {bucket.objects.map((obj: any) => (
            <div key={obj.id} className="flex items-center gap-2 text-xs text-gcp-muted">
              <File className="w-3 h-3" />
              <span className="flex-1 truncate">{obj.name}</span>
              <span className="font-mono">{formatBytes(Number(obj.sizeBytes || 0))}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CreateBucketModal({ onClose }: { onClose: () => void }) {
  const createBucket = useStore((s) => s.createBucket);
  const addToast = useStore((s) => s.addToast);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ name: "", location: REGIONS[0], storageClass: "Standard", versioning: false });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await createBucket(form);
      addToast(`Bucket "${form.name}" created`, "success");
      onClose();
    } catch (err: any) { addToast(err.message, "error"); }
    finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full" onClick={(e) => e.stopPropagation()}>
        <div className="p-6 border-b border-gcp-border flex items-center justify-between">
          <h2 className="text-lg font-semibold">Create Bucket</h2>
          <button onClick={onClose} className="btn-icon"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Bucket name (globally unique)</label>
            <input className="input-field" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="my-bucket-name" required />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Location</label>
            <select className="select-field" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })}>
              {REGIONS.map((r) => <option key={r}>{r}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Storage class</label>
            <select className="select-field" value={form.storageClass} onChange={(e) => setForm({ ...form, storageClass: e.target.value })}>
              {["Standard", "Nearline", "Coldline", "Archive"].map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.versioning} onChange={(e) => setForm({ ...form, versioning: e.target.checked })} />
            Enable versioning
          </label>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
            <button type="submit" className="btn-primary" disabled={loading}>{loading ? "Creating..." : "Create"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}
