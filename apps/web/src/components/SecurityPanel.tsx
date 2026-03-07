"use client";
import { useState, useEffect } from "react";
import { useStore } from "../store";
import { Security as SecApi, formatApiError } from "../lib/apiClient";
import { Lock, Key, Plus, Trash2, ChevronDown, ChevronRight } from "lucide-react";

function Section({ title, icon: Icon, children }: any) {
  return (
    <div className="mb-8">
      <div className="flex items-center gap-2 mb-3">
        <Icon className="w-4 h-4 text-gcp-blue" />
        <h2 className="font-medium">{title}</h2>
      </div>
      {children}
    </div>
  );
}

const STATE_COLORS: Record<string, string> = {
  ENABLED: "bg-green-100 text-green-700",
  DISABLED: "bg-gray-100 text-gray-600",
  DESTROYED: "bg-red-100 text-red-700",
};

export function SecurityPanel() {
  const projectId = useStore(s => s.projectId);
  const addToast = useStore(s => s.addToast);
  const [secrets, setSecrets] = useState<any[]>([]);
  const [keyRings, setKeyRings] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreate, setShowCreate] = useState<"secret"|"keyring"|null>(null);
  const [showKey, setShowKey] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [secretForm, setSecretForm] = useState({ name: "", replication: "automatic" });
  const [ringForm, setRingForm] = useState({ name: "", location: "global" });
  const [keyForm, setKeyForm] = useState({ name: "", purpose: "ENCRYPT_DECRYPT", rotationDays: 90 });

  const load = async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const [s, k] = await Promise.all([SecApi.listSecrets(projectId), SecApi.listKeyRings(projectId)]);
      setSecrets(s as any[]); setKeyRings(k as any[]);
    } catch (e: any) { addToast(formatApiError(e), "error"); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [projectId]);

  const createSecret = async () => {
    if (!projectId || !secretForm.name) return;
    try {
      const s = await SecApi.createSecret(projectId, secretForm);
      setSecrets(p => [s, ...p]); setShowCreate(null);
      setSecretForm({ name: "", replication: "automatic" });
      addToast(`Secret ${secretForm.name} created`, "success");
    } catch (e: any) { addToast(formatApiError(e), "error"); }
  };

  const deleteSecret = async (s: any) => {
    if (!projectId) return;
    try {
      await SecApi.deleteSecret(projectId, s.id);
      setSecrets(p => p.filter(x => x.id !== s.id));
      addToast(`Secret ${s.name} deleted`, "success");
    } catch (e: any) { addToast(formatApiError(e), "error"); }
  };

  const createKeyRing = async () => {
    if (!projectId || !ringForm.name) return;
    try {
      const r = await SecApi.createKeyRing(projectId, ringForm);
      setKeyRings(p => [{ ...r, keys: [] }, ...p]); setShowCreate(null);
      setRingForm({ name: "", location: "global" });
      addToast(`Key ring ${ringForm.name} created`, "success");
    } catch (e: any) { addToast(formatApiError(e), "error"); }
  };

  const deleteKeyRing = async (r: any) => {
    if (!projectId) return;
    try {
      await SecApi.deleteKeyRing(projectId, r.id);
      setKeyRings(p => p.filter(x => x.id !== r.id));
      addToast(`Key ring ${r.name} deleted`, "success");
    } catch (e: any) { addToast(formatApiError(e), "error"); }
  };

  const createKey = async (ringId: string) => {
    if (!projectId || !keyForm.name) return;
    try {
      const k = await SecApi.createKey(projectId, ringId, keyForm);
      setKeyRings(p => p.map(r => r.id === ringId ? { ...r, keys: [...(r.keys || []), k] } : r));
      setShowKey(null); setKeyForm({ name: "", purpose: "ENCRYPT_DECRYPT", rotationDays: 90 });
      addToast(`Key ${keyForm.name} created`, "success");
    } catch (e: any) { addToast(formatApiError(e), "error"); }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-medium">Security</h1>
          <p className="text-sm text-gcp-muted mt-0.5">Secret Manager and Cloud KMS</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowCreate("secret")} className="btn text-xs flex items-center gap-1"><Plus className="w-3 h-3" /> Secret</button>
          <button onClick={() => setShowCreate("keyring")} className="btn text-xs flex items-center gap-1"><Plus className="w-3 h-3" /> Key Ring</button>
        </div>
      </div>

      {showCreate === "secret" && (
        <div className="card p-4 mb-4 border-blue-200 bg-blue-50">
          <h3 className="font-medium mb-3">New Secret</h3>
          <div className="flex gap-3 items-end mb-3">
            <div><label className="text-xs text-gcp-muted block mb-1">Secret Name *</label>
              <input className="input" value={secretForm.name} onChange={e => setSecretForm(f => ({ ...f, name: e.target.value }))} placeholder="my-secret" /></div>
            <p className="text-xs text-gcp-muted mt-0.5">Letters, digits, hyphens, underscores (e.g. my-secret)</p>
            <div><label className="text-xs text-gcp-muted block mb-1">Replication</label>
              <select className="input" value={secretForm.replication} onChange={e => setSecretForm(f => ({ ...f, replication: e.target.value }))}>
                <option>automatic</option><option>user-managed</option></select></div>
            <button onClick={createSecret} className="btn-primary">Create</button>
            <button onClick={() => setShowCreate(null)} className="btn">Cancel</button>
          </div>
        </div>
      )}

      {showCreate === "keyring" && (
        <div className="card p-4 mb-4 border-blue-200 bg-blue-50">
          <h3 className="font-medium mb-3">New Key Ring</h3>
          <div className="flex gap-3 items-end mb-3">
            <div><label className="text-xs text-gcp-muted block mb-1">Key Ring Name *</label>
              <input className="input" value={ringForm.name} onChange={e => setRingForm(f => ({ ...f, name: e.target.value }))} placeholder="my-keyring" /></div>
            <p className="text-xs text-gcp-muted mt-0.5">Letters, digits, hyphens, underscores (e.g. my-keyring)</p>
            <div><label className="text-xs text-gcp-muted block mb-1">Location</label>
              <select className="input" value={ringForm.location} onChange={e => setRingForm(f => ({ ...f, location: e.target.value }))}>
                <option>global</option><option>us-central1</option><option>europe-west1</option><option>asia-east1</option></select></div>
            <button onClick={createKeyRing} className="btn-primary">Create</button>
            <button onClick={() => setShowCreate(null)} className="btn">Cancel</button>
          </div>
        </div>
      )}

      <Section title="Secret Manager" icon={Lock}>
        {secrets.length === 0 ? <p className="text-sm text-gcp-muted">No secrets. Create one to securely store credentials.</p> :
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b"><tr>{["Name","Replication","Versions","Created",""].map(h => <th key={h} className="px-4 py-2 text-left text-xs font-medium text-gcp-muted">{h}</th>)}</tr></thead>
              <tbody className="divide-y">
                {secrets.map(s => (
                  <tr key={s.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2.5 font-medium">{s.name}</td>
                    <td className="px-4 py-2.5 text-gcp-muted">{s.replication}</td>
                    <td className="px-4 py-2.5 text-gcp-muted">{s.versions}</td>
                    <td className="px-4 py-2.5 text-gcp-muted text-xs">{new Date(s.createdAt).toLocaleDateString()}</td>
                    <td className="px-4 py-2.5">
                      <button onClick={() => deleteSecret(s)} className="btn-icon text-gcp-red hover:bg-red-50"><Trash2 className="w-4 h-4" /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>}
      </Section>

      <Section title="Cloud KMS" icon={Key}>
        {keyRings.length === 0 ? <p className="text-sm text-gcp-muted">No key rings. Create one to manage encryption keys.</p> :
          <div className="space-y-2">
            {keyRings.map(r => (
              <div key={r.id} className="card">
                <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50"
                  onClick={() => setExpanded(p => { const n = new Set(p); n.has(r.id) ? n.delete(r.id) : n.add(r.id); return n; })}>
                  <div className="flex items-center gap-3">
                    {expanded.has(r.id) ? <ChevronDown className="w-4 h-4 text-gcp-muted" /> : <ChevronRight className="w-4 h-4 text-gcp-muted" />}
                    <Key className="w-4 h-4 text-gcp-blue" />
                    <span className="font-medium text-sm">{r.name}</span>
                    <span className="text-xs text-gcp-muted">{r.location} · {r.keys?.length || 0} keys</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={e => { e.stopPropagation(); setShowKey(r.id); }} className="btn text-xs flex items-center gap-1"><Plus className="w-3 h-3" /> Add Key</button>
                    <button onClick={e => { e.stopPropagation(); deleteKeyRing(r); }} className="btn-icon text-gcp-red hover:bg-red-50"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>

                {showKey === r.id && (
                  <div className="px-4 pb-4 border-t bg-gray-50">
                    <div className="pt-3 flex gap-3 items-end">
                      <div><label className="text-xs text-gcp-muted block mb-1">Key Name *</label>
                        <input className="input" value={keyForm.name} onChange={e => setKeyForm(f => ({ ...f, name: e.target.value }))} placeholder="my-key" /></div>
                        <p className="text-xs text-gcp-muted mt-0.5">Letters, digits, hyphens, underscores</p>
                      <div><label className="text-xs text-gcp-muted block mb-1">Purpose</label>
                        <select className="input" value={keyForm.purpose} onChange={e => setKeyForm(f => ({ ...f, purpose: e.target.value }))}>
                          <option>ENCRYPT_DECRYPT</option><option>SIGN_VERIFY</option><option>ASYMMETRIC_DECRYPT</option></select></div>
                      <div><label className="text-xs text-gcp-muted block mb-1">Rotation (days)</label>
                        <input className="input w-24" type="number" value={keyForm.rotationDays} onChange={e => setKeyForm(f => ({ ...f, rotationDays: +e.target.value }))} /></div>
                      <button onClick={() => createKey(r.id)} className="btn-primary">Create</button>
                      <button onClick={() => setShowKey(null)} className="btn">Cancel</button>
                    </div>
                  </div>
                )}

                {expanded.has(r.id) && (
                  <div className="border-t">
                    {(r.keys || []).length === 0 ? <p className="text-sm text-gcp-muted px-12 py-3">No keys</p> :
                      r.keys.map((k: any) => (
                        <div key={k.id} className="flex items-center justify-between px-12 py-2 border-b last:border-0 hover:bg-gray-50">
                          <div className="flex items-center gap-3">
                            <span className="text-sm font-medium">{k.name}</span>
                            <span className="text-xs text-gcp-muted">{k.purpose}</span>
                            <span className={`badge ${STATE_COLORS[k.state] || ""}`}>{k.state}</span>
                            <span className="text-xs text-gcp-muted">rotates every {k.rotationDays}d</span>
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            ))}
          </div>}
      </Section>
    </div>
  );
}
