"use client";
import { useState, useEffect } from "react";
import { useStore } from "../store";
import { TasksApi } from "../lib/apiClient";
import { ListTodo, Plus, Trash2, Pause, Play } from "lucide-react";
export function CloudTasksPanel() {
  const projectId = useStore(s=>s.projectId); const addToast = useStore(s=>s.addToast);
  const [items, setItems] = useState<any[]>([]); const [loading, setLoading] = useState(false); const [show, setShow] = useState(false);
  const [form, setForm] = useState<any>({ "name":"", "region":"us-central1", "rateLimitPerSecond":500, "maxConcurrent":1000 });
  const load = async()=>{ if(!projectId) return; setLoading(true); try{setItems(await TasksApi.list(projectId))}catch(e:any){addToast(e.message,"error")}finally{setLoading(false)} };
  useEffect(()=>{load()},[projectId]);
  const create = async()=>{ if(!projectId) return; try{await TasksApi.create(projectId,form);addToast("Task Queue created","success");setShow(false);load()}catch(e:any){addToast(e.message,"error")} };
  const del = async(id:string)=>{ if(!projectId) return; try{await TasksApi.delete(projectId,id);addToast("Deleted","success");load()}catch(e:any){addToast(e.message,"error")} };
  const toggle = async(id:string,cur:string)=>{ if(!projectId) return; try{await TasksApi.toggle(projectId,id,cur==="RUNNING"?"PAUSED":"RUNNING");load()}catch(e:any){addToast(e.message,"error")} };
  return(<div className="p-6 space-y-6">
    <div className="flex items-center justify-between"><h1 className="text-xl font-semibold flex items-center gap-2"><ListTodo className="w-5 h-5 text-gcp-blue"/>Task Queues</h1>
      <button className="btn-primary flex items-center gap-1" onClick={()=>setShow(true)}><Plus className="w-4 h-4"/>Create</button></div>
    {loading?<div className="text-center py-8 text-gcp-muted">Loading...</div>:items.length===0?<p className="text-gcp-muted text-center py-8">No task queues yet.</p>:
    <div className="space-y-3">{items.map((i:any)=><div key={i.id} className="card p-4 flex items-center justify-between">
      <div><div className="font-medium">{i.name||i.displayName}</div><div className="text-xs text-gcp-muted mt-1">{`${i.region} · ${i.rateLimitPerSecond} req/s · ${i.taskCount} tasks`}</div></div>
      <div className="flex items-center gap-2">{i.status&&<span className={`px-2 py-0.5 text-xs rounded-full ${i.status==="RUNNING"||i.status==="ACTIVE"||i.status==="ON_TRACK"?"bg-green-100 text-green-700":i.status==="CREATING"||i.status==="PAUSED"||i.status==="WARNING"?"bg-yellow-100 text-yellow-700":"bg-gray-100 text-gray-600"}`}>{i.status}</span>}
        <button onClick={()=>toggle(i.id,i.status)} className="hover:bg-gray-100 p-1 rounded">{i.status==="RUNNING"?<Pause className="w-4 h-4"/>:<Play className="w-4 h-4"/>}</button><button onClick={()=>del(i.id)} className="text-gcp-red hover:bg-red-50 p-1 rounded"><Trash2 className="w-4 h-4"/></button></div></div>)}</div>}
    {show&&<div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"><div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md space-y-4">
      <h2 className="text-lg font-semibold">Create Task Queue</h2>
      <input className="input-field" placeholder="Queue name" value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/>
      <select className="input-field" value={form.region} onChange={e=>setForm({...form,region:e.target.value})}><option key="us-central1" value="us-central1">us-central1</option><option key="us-east1" value="us-east1">us-east1</option><option key="europe-west1" value="europe-west1">europe-west1</option><option key="asia-east1" value="asia-east1">asia-east1</option></select>
      <input className="input-field" type="number" placeholder="Rate limit/sec" value={form.rateLimitPerSecond} onChange={e=>setForm({...form,rateLimitPerSecond:+e.target.value})}/>
      <input className="input-field" type="number" placeholder="Max concurrent" value={form.maxConcurrent} onChange={e=>setForm({...form,maxConcurrent:+e.target.value})}/>
      <div className="flex gap-2"><button className="btn-primary flex-1" onClick={create}>Create</button><button className="btn-secondary flex-1" onClick={()=>setShow(false)}>Cancel</button></div>
    </div></div>}
  </div>);
}
