"use client";
import { useState, useEffect } from "react";
import { useStore } from "../store";
import { ServiceAccountsApi, formatApiError } from "../lib/apiClient";
import { UserCog, Plus, Trash2 } from "lucide-react";
export function ServiceAccountsPanel() {
  const projectId = useStore(s=>s.projectId); const addToast = useStore(s=>s.addToast);
  const [items, setItems] = useState<any[]>([]); const [loading, setLoading] = useState(false); const [show, setShow] = useState(false);
  const [form, setForm] = useState<any>({ "name":"", "displayName":"", "description":"" });
  const load = async()=>{ if(!projectId) return; setLoading(true); try{setItems(await ServiceAccountsApi.list(projectId))}catch(e:any){addToast(formatApiError(e),"error")}finally{setLoading(false)} };
  useEffect(()=>{load()},[projectId]);
  const create = async()=>{ if(!projectId) return; try{await ServiceAccountsApi.create(projectId,form);addToast("Service Account created","success");setShow(false);load()}catch(e:any){addToast(formatApiError(e),"error")} };
  const del = async(id:string)=>{ if(!projectId) return; try{await ServiceAccountsApi.delete(projectId,id);addToast("Deleted","success");load()}catch(e:any){addToast(formatApiError(e),"error")} };
  return(<div className="p-6 space-y-6">
    <div className="flex items-center justify-between"><h1 className="text-xl font-semibold flex items-center gap-2"><UserCog className="w-5 h-5 text-gcp-blue"/>Service Accounts</h1>
      <button className="btn-primary flex items-center gap-1" onClick={()=>setShow(true)}><Plus className="w-4 h-4"/>Create</button></div>
    {loading?<div className="text-center py-8 text-gcp-muted">Loading...</div>:items.length===0?<p className="text-gcp-muted text-center py-8">No service accounts yet.</p>:
    <div className="space-y-3">{items.map((i:any)=><div key={i.id} className="card p-4 flex items-center justify-between">
      <div><div className="font-medium">{i.name||i.displayName}</div><div className="text-xs text-gcp-muted mt-1">{`${i.email}${i.disabled?' · DISABLED':''}`}</div></div>
      <div className="flex items-center gap-2">{i.status&&<span className={`px-2 py-0.5 text-xs rounded-full ${i.status==="RUNNING"||i.status==="ACTIVE"||i.status==="ON_TRACK"?"bg-green-100 text-green-700":i.status==="CREATING"||i.status==="PAUSED"||i.status==="WARNING"?"bg-yellow-100 text-yellow-700":"bg-gray-100 text-gray-600"}`}>{i.status}</span>}
        <button onClick={()=>del(i.id)} className="text-gcp-red hover:bg-red-50 p-1 rounded"><Trash2 className="w-4 h-4"/></button></div></div>)}</div>}
    {show&&<div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"><div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md space-y-4">
      <h2 className="text-lg font-semibold">Create Service Account</h2>
      <input className="input-field" placeholder="Account name (6-30 chars)" value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/>
      <p className="text-xs text-gcp-muted mt-0.5">6–30 chars: lowercase letters, digits, hyphens (e.g. my-svc)</p>
      <input className="input-field" placeholder="Display name" value={form.displayName} onChange={e=>setForm({...form,displayName:e.target.value})}/>
      <input className="input-field" placeholder="Description" value={form.description} onChange={e=>setForm({...form,description:e.target.value})}/>
      <div className="flex gap-2"><button className="btn-primary flex-1" onClick={create}>Create</button><button className="btn-secondary flex-1" onClick={()=>setShow(false)}>Cancel</button></div>
    </div></div>}
  </div>);
}
