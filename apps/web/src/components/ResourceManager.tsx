"use client";
import { useState, useEffect } from "react";
import { useStore } from "../store";
import { OrganizationsApi } from "../lib/apiClient";
import { Building2, FolderTree, Plus, Trash2 } from "lucide-react";
export function ResourceManagerPanel() {
  const addToast = useStore(s=>s.addToast);
  const [orgs, setOrgs] = useState<any[]>([]); const [loading, setLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name:"", displayName:"", domain:"" });
  const load = async()=>{ setLoading(true); try{setOrgs(await OrganizationsApi.list())}catch(e:any){addToast(e.message,"error")}finally{setLoading(false)} };
  useEffect(()=>{load()},[]);
  const create = async()=>{ try{await OrganizationsApi.create(form);addToast("Organization created","success");setShowCreate(false);load()}catch(e:any){addToast(e.message,"error")} };
  const del = async(id:string)=>{ try{await OrganizationsApi.delete(id);addToast("Deleted","success");load()}catch(e:any){addToast(e.message,"error")} };
  return(<div className="p-6 space-y-6">
    <div className="flex items-center justify-between"><h1 className="text-xl font-semibold flex items-center gap-2"><Building2 className="w-5 h-5 text-gcp-blue"/>Resource Manager</h1>
      <button className="btn-primary flex items-center gap-1" onClick={()=>setShowCreate(true)}><Plus className="w-4 h-4"/>Create Organization</button></div>
    <p className="text-sm text-gcp-muted">Manage your organization hierarchy: Organizations → Folders → Projects</p>
    {loading?<div className="text-center py-8 text-gcp-muted">Loading...</div>:orgs.length===0?<p className="text-gcp-muted text-center py-8">No organizations yet. Create one to manage project hierarchy.</p>:
    <div className="space-y-4">{orgs.map((o:any)=><div key={o.id} className="card p-4">
      <div className="flex items-center justify-between"><div><div className="font-medium flex items-center gap-2"><Building2 className="w-4 h-4 text-blue-600"/>{o.displayName}</div>
        <div className="text-xs text-gcp-muted mt-1">{o.name}{o.domain?` · ${o.domain}`:""} · {(o.folders||[]).length} folders</div></div>
        <button onClick={()=>del(o.id)} className="text-gcp-red hover:bg-red-50 p-1 rounded"><Trash2 className="w-4 h-4"/></button></div>
      {(o.folders||[]).length>0&&<div className="mt-3 ml-6 space-y-1">{o.folders.map((f:any)=><div key={f.id} className="flex items-center gap-2 text-sm"><FolderTree className="w-3 h-3 text-yellow-600"/>{f.displayName}</div>)}</div>}
    </div>)}</div>}
    {showCreate&&<div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"><div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md space-y-4">
      <h2 className="text-lg font-semibold">Create Organization</h2>
      <input className="input-field" placeholder="Organization ID (lowercase)" value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/>
      <input className="input-field" placeholder="Display name" value={form.displayName} onChange={e=>setForm({...form,displayName:e.target.value})}/>
      <input className="input-field" placeholder="Domain (optional)" value={form.domain} onChange={e=>setForm({...form,domain:e.target.value})}/>
      <div className="flex gap-2"><button className="btn-primary flex-1" onClick={create}>Create</button><button className="btn-secondary flex-1" onClick={()=>setShowCreate(false)}>Cancel</button></div>
    </div></div>}
  </div>);
}
