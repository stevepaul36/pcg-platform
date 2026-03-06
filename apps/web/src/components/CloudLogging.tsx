"use client";
import { useState, useEffect } from "react";
import { useStore } from "../store";
import { LoggingApi } from "../lib/apiClient";
import { FileText, Plus, Trash2 } from "lucide-react";
export function CloudLoggingPanel() {
  const projectId = useStore(s=>s.projectId); const addToast = useStore(s=>s.addToast);
  const [items, setItems] = useState<any[]>([]); const [loading, setLoading] = useState(false); const [show, setShow] = useState(false);
  const [form, setForm] = useState<any>({ "name":"", "destination":"", "filter":"" });
  const load = async()=>{ if(!projectId) return; setLoading(true); try{setItems(await LoggingApi.list(projectId))}catch(e:any){addToast(e.message,"error")}finally{setLoading(false)} };
  useEffect(()=>{load()},[projectId]);
  const create = async()=>{ if(!projectId) return; try{await LoggingApi.create(projectId,form);addToast("Log Sink created","success");setShow(false);load()}catch(e:any){addToast(e.message,"error")} };
  const del = async(id:string)=>{ if(!projectId) return; try{await LoggingApi.delete(projectId,id);addToast("Deleted","success");load()}catch(e:any){addToast(e.message,"error")} };
  return(<div className="p-6 space-y-6">
    <div className="flex items-center justify-between"><h1 className="text-xl font-semibold flex items-center gap-2"><FileText className="w-5 h-5 text-gcp-blue"/>Log Sinks</h1>
      <button className="btn-primary flex items-center gap-1" onClick={()=>setShow(true)}><Plus className="w-4 h-4"/>Create</button></div>
    {loading?<div className="text-center py-8 text-gcp-muted">Loading...</div>:items.length===0?<p className="text-gcp-muted text-center py-8">No log sinks yet.</p>:
    <div className="space-y-3">{items.map((i:any)=><div key={i.id} className="card p-4 flex items-center justify-between">
      <div><div className="font-medium">{i.name||i.displayName}</div><div className="text-xs text-gcp-muted mt-1">{`${i.destination} · filter: ${i.filter||'(none)'}`}</div></div>
      <div className="flex items-center gap-2">{i.status&&<span className={`px-2 py-0.5 text-xs rounded-full ${i.status==="RUNNING"||i.status==="ACTIVE"||i.status==="ON_TRACK"?"bg-green-100 text-green-700":i.status==="CREATING"||i.status==="PAUSED"||i.status==="WARNING"?"bg-yellow-100 text-yellow-700":"bg-gray-100 text-gray-600"}`}>{i.status}</span>}
        <button onClick={()=>del(i.id)} className="text-gcp-red hover:bg-red-50 p-1 rounded"><Trash2 className="w-4 h-4"/></button></div></div>)}</div>}
    {show&&<div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"><div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md space-y-4">
      <h2 className="text-lg font-semibold">Create Log Sink</h2>
      <input className="input-field" placeholder="Sink name" value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/>
      <input className="input-field" placeholder="Destination URI" value={form.destination} onChange={e=>setForm({...form,destination:e.target.value})}/>
      <input className="input-field" placeholder="Log filter" value={form.filter} onChange={e=>setForm({...form,filter:e.target.value})}/>
      <div className="flex gap-2"><button className="btn-primary flex-1" onClick={create}>Create</button><button className="btn-secondary flex-1" onClick={()=>setShow(false)}>Cancel</button></div>
    </div></div>}
  </div>);
}
