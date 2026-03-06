"use client";

import { useState } from "react";
import { useStore } from "../store";
import { Shield, Plus, Trash2, X, Users, Loader2 } from "lucide-react";

export function IAMPanel() {
  const members = useStore((s) => s.iamMembers);
  const loading = useStore((s) => s.loading.iam);
  const [showAdd, setShowAdd] = useState(false);

  return (
    <div className="space-y-4 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">IAM & Admin</h1>
          <p className="text-sm text-gcp-muted mt-1">Manage project access and roles</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> Add Member
        </button>
      </div>

      <div className="card">
        {loading && members.length === 0 ? (
          <div className="p-12 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-gcp-blue" /></div>
        ) : members.length === 0 ? (
          <div className="p-12 text-center">
            <Users className="w-10 h-10 text-gcp-muted mx-auto mb-3" />
            <p className="text-sm text-gcp-muted">No IAM members</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gcp-border text-left text-xs text-gcp-muted uppercase">
                <th className="px-6 py-3">Member</th>
                <th className="px-6 py-3">Role</th>
                <th className="px-6 py-3">Type</th>
                <th className="px-6 py-3">Added</th>
                <th className="px-6 py-3 w-12"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gcp-border">
              {members.map((m) => <MemberRow key={m.id} member={m} />)}
            </tbody>
          </table>
        )}
      </div>

      {showAdd && <AddMemberModal onClose={() => setShowAdd(false)} />}
    </div>
  );
}

function MemberRow({ member }: { member: any }) {
  const revokeIAM = useStore((s) => s.revokeIAM);
  const addToast = useStore((s) => s.addToast);

  const handleRevoke = async () => {
    if (!confirm(`Remove ${member.email}?`)) return;
    try { await revokeIAM(member.id); addToast("Member removed", "success"); }
    catch (err: any) { addToast(err.message, "error"); }
  };

  const roleCls = member.role === "Owner" ? "bg-purple-50 text-purple-700" :
    member.role === "Editor" ? "bg-blue-50 text-gcp-blue" : "bg-gray-100 text-gcp-muted";

  return (
    <tr className="hover:bg-gray-50">
      <td className="px-6 py-3 text-sm">{member.email}</td>
      <td className="px-6 py-3"><span className={`badge ${roleCls}`}>{member.role}</span></td>
      <td className="px-6 py-3 text-sm text-gcp-muted capitalize">{member.type}</td>
      <td className="px-6 py-3 text-xs text-gcp-muted">{new Date(member.addedAt).toLocaleDateString()}</td>
      <td className="px-6 py-3">
        <button onClick={handleRevoke} className="btn-icon"><Trash2 className="w-4 h-4 text-gcp-red" /></button>
      </td>
    </tr>
  );
}

function AddMemberModal({ onClose }: { onClose: () => void }) {
  const grantIAM = useStore((s) => s.grantIAM);
  const addToast = useStore((s) => s.addToast);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ email: "", role: "Viewer" as string, type: "user" as string });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true);
    try { await grantIAM(form); addToast(`${form.email} added as ${form.role}`, "success"); onClose(); }
    catch (err: any) { addToast(err.message, "error"); }
    finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full" onClick={(e) => e.stopPropagation()}>
        <div className="p-6 border-b border-gcp-border flex items-center justify-between">
          <h2 className="text-lg font-semibold">Add IAM Member</h2>
          <button onClick={onClose} className="btn-icon"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Email</label>
            <input type="email" className="input-field" value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })} required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Role</label>
              <select className="select-field" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                {["Viewer", "Editor", "Owner"].map((r) => <option key={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Type</label>
              <select className="select-field" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                {["user", "serviceAccount", "group"].map((t) => <option key={t}>{t}</option>)}
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
            <button type="submit" className="btn-primary" disabled={loading}>{loading ? "Adding..." : "Add Member"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
