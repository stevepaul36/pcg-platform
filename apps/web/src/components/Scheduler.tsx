"use client";
import { useState, useEffect } from "react";
import { useStore } from "../store";
import { Scheduler as SchApi, formatApiError } from "../lib/apiClient";
import { Clock, Plus, Trash2, Pause, Play } from "lucide-react";
const TARGET_TYPES = ["HTTP","PUBSUB","APP_ENGINE"];
const METHODS = ["GET","POST","PUT","DELETE","PATCH"];
export function SchedulerPanel() {
  const projectId = useStore(s=>s.projectId); const addToast = useStore(s=>s.addToast);
  const [jobs, setJobs] = useState<any[]>([]); const [loading, setLoading] = useState(false); const [show, setShow] = useState(false);
  const [form, setForm] = useState({ name:"", description:"", schedule:"*/5 * * * *", timezone:"UTC", targetType:"HTTP", targetUri:"", httpMethod:"POST" });
  const load = async()=>{ if(!projectId) return; setLoading(true); try{setJobs(await SchApi.list(projectId))}catch(e:any){addToast(formatApiError(e),"error")}finally{setLoading(false)} };
  useEffect(()=>{load()},[projectId]);
  const create = async()=>{ if(!projectId) return; try{await SchApi.create(projectId,form);addToast("Job created","success");setShow(false);load()}catch(e:any){addToast(formatApiError(e),"error")} };
  const toggle = async(id:string,cur:string)=>{ if(!projectId) return; try{await SchApi.toggle(projectId,id,cur==="ENABLED"?"PAUSED":"ENABLED");load()}catch(e:any){addToast(formatApiError(e),"error")} };
  const del = async(id:string)=>{ if(!projectId) return; try{await SchApi.delete(projectId,id);addToast("Deleted","success");load()}catch(e:any){addToast(formatApiError(e),"error")} };
  return(<div className="p-6 space-y-6">
    <div className="flex items-center justify-between"><h1 className="text-xl font-semibold flex items-center gap-2"><Clock className="w-5 h-5 text-gcp-blue"/>Cloud Scheduler</h1>
      <button className="btn-primary flex items-center gap-1" onClick={()=>setShow(true)}><Plus className="w-4 h-4"/>Create Job</button></div>
    {loading?<div className="text-center py-8 text-gcp-muted">Loading...</div>:jobs.length===0?<p className="text-gcp-muted text-center py-8">No scheduler jobs yet.</p>:
    <div className="space-y-3">{jobs.map((j:any)=><div key={j.id} className="card p-4 flex items-center justify-between">
      <div><div className="font-medium flex items-center gap-2"><Clock className="w-4 h-4 text-indigo-500"/>{j.name}</div>
        <div className="text-xs text-gcp-muted mt-1">{j.schedule} ({j.timezone}) · {j.targetType} → {j.targetUri}</div></div>
      <div className="flex items-center gap-2">
        <span className={`px-2 py-0.5 text-xs rounded-full ${j.status==="ENABLED"?"bg-green-100 text-green-700":"bg-yellow-100 text-yellow-700"}`}>{j.status}</span>
        <button onClick={()=>toggle(j.id,j.status)} className="hover:bg-gray-100 p-1 rounded">{j.status==="ENABLED"?<Pause className="w-4 h-4"/>:<Play className="w-4 h-4"/>}</button>
        <button onClick={()=>del(j.id)} className="text-gcp-red hover:bg-red-50 p-1 rounded"><Trash2 className="w-4 h-4"/></button></div></div>)}</div>}
    {show&&<div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"><div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md space-y-4">
      <h2 className="text-lg font-semibold">Create Scheduler Job</h2>
      <input className="input-field" placeholder="Job name" value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/>
      <p className="text-xs text-gcp-muted mt-0.5">Lowercase letters, digits, hyphens (e.g. daily-job)</p>
      <input className="input-field" placeholder="Cron schedule (e.g. */5 * * * *)" value={form.schedule} onChange={e=>setForm({...form,schedule:e.target.value})}/>
      <select className="input-field" value={form.targetType} onChange={e=>setForm({...form,targetType:e.target.value})}>{TARGET_TYPES.map(t=><option key={t}>{t}</option>)}</select>
      <input className="input-field" placeholder="Target URI / Topic" value={form.targetUri} onChange={e=>setForm({...form,targetUri:e.target.value})}/>
      <select className="input-field" value={form.httpMethod} onChange={e=>setForm({...form,httpMethod:e.target.value})}>{METHODS.map(m=><option key={m}>{m}</option>)}</select>
      <div className="flex gap-2"><button className="btn-primary flex-1" onClick={create}>Create</button><button className="btn-secondary flex-1" onClick={()=>setShow(false)}>Cancel</button></div>
    </div></div>}
  </div>);
}
