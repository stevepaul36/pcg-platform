"use client";
import { useState, useEffect } from "react";
import { useStore } from "../store";
import { DataprocApi } from "../lib/apiClient";
import { Server, Plus, Trash2 } from "lucide-react";
const REGIONS = ["us-central1","us-east1","europe-west1","asia-east1"];
const MASTER_TYPES = ["n1-standard-2","n1-standard-4","n1-standard-8","n2-standard-4"];
const WORKER_TYPES = ["n1-standard-2","n1-standard-4","n2-standard-2"];
const IMAGE_VERSIONS = ["2.2-debian12","2.2-rocky9","2.1-debian11","2.1-rocky8","2.0-debian10"];
const STATUS_COLORS: Record<string,string> = { RUNNING:"bg-green-100 text-green-700",CREATING:"bg-yellow-100 text-yellow-700",STOPPED:"bg-gray-100 text-gray-600",ERROR:"bg-red-100 text-red-700",DELETING:"bg-orange-100 text-orange-700"};
export function DataprocPanelPanel() {
  const projectId = useStore(s=>s.projectId); const addToast = useStore(s=>s.addToast);
  const [items, setItems] = useState<any[]>([]); const [loading, setLoading] = useState(false); const [show, setShow] = useState(false);
  const [form, setForm] = useState({ name:"", region:"us-central1", masterType:"n1-standard-4", workerType:"n1-standard-2", workerCount:2, imageVersion:"2.2-debian12", autoscaling:false });
  const load = async()=>{ if(!projectId) return; setLoading(true); try{setItems(await DataprocApi.list(projectId))}catch(e:any){addToast(e.message,"error")}finally{setLoading(false)} };
  useEffect(()=>{load()},[projectId]);
  const create = async()=>{ if(!projectId) return; try{await DataprocApi.create(projectId,form);addToast("Cluster creating...","success");setShow(false);setTimeout(load,4500)}catch(e:any){addToast(e.message,"error")} };
  const del = async(id:string)=>{ if(!projectId) return; try{await DataprocApi.delete(projectId,id);addToast("Deleted","success");load()}catch(e:any){addToast(e.message,"error")} };
  return(<div className="p-6 space-y-6">
    <div className="flex items-center justify-between"><h1 className="text-xl font-semibold flex items-center gap-2"><Server className="w-5 h-5 text-gcp-blue"/>Dataproc</h1>
      <button className="btn-primary flex items-center gap-1" onClick={()=>setShow(true)}><Plus className="w-4 h-4"/>Create Cluster</button></div>
    {loading?<div className="text-center py-8 text-gcp-muted">Loading...</div>:items.length===0?<p className="text-gcp-muted text-center py-8">No Dataproc clusters yet.</p>:
    <div className="space-y-3">{items.map((i:any)=><div key={i.id} className="card p-4 flex items-center justify-between">
      <div><div className="font-medium">{i.name}</div>
        <div className="text-xs text-gcp-muted mt-1">{`${i.region} · ${i.masterType} + ${i.workerCount}× ${i.workerType} · ${i.imageVersion}`}</div>
        <div className="text-xs text-gcp-muted">{`$${i.hourlyCost?.toFixed(3)}/hr${i.autoscaling?" · Autoscaling":""}`}</div></div>
      <div className="flex items-center gap-2"><span className={`px-2 py-0.5 text-xs rounded-full ${STATUS_COLORS[i.status]||"bg-gray-100 text-gray-600"}`}>{i.status}</span>
        <button onClick={()=>del(i.id)} className="text-gcp-red hover:bg-red-50 p-1 rounded"><Trash2 className="w-4 h-4"/></button></div></div>)}</div>}
    {show&&<div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"><div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md space-y-4 max-h-[90vh] overflow-y-auto">
      <h2 className="text-lg font-semibold">Create Dataproc Cluster</h2>
      <input className="input-field" placeholder="Cluster name (lowercase)" value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/>
      <select className="input-field" value={form.region} onChange={e=>setForm({...form,region:e.target.value})}>{REGIONS.map(r=><option key={r}>{r}</option>)}</select>
      <select className="input-field" value={form.imageVersion} onChange={e=>setForm({...form,imageVersion:e.target.value})}>{IMAGE_VERSIONS.map(v=><option key={v}>{v}</option>)}</select>
      <div className="grid grid-cols-2 gap-2">
        <div><label className="text-xs text-gcp-muted mb-1 block">Master type</label>
          <select className="input-field" value={form.masterType} onChange={e=>setForm({...form,masterType:e.target.value})}>{MASTER_TYPES.map(t=><option key={t}>{t}</option>)}</select></div>
        <div><label className="text-xs text-gcp-muted mb-1 block">Worker type</label>
          <select className="input-field" value={form.workerType} onChange={e=>setForm({...form,workerType:e.target.value})}>{WORKER_TYPES.map(t=><option key={t}>{t}</option>)}</select></div>
      </div>
      <input className="input-field" type="number" min="2" max="500" placeholder="Worker count" value={form.workerCount} onChange={e=>setForm({...form,workerCount:+e.target.value})}/>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.autoscaling} onChange={e=>setForm({...form,autoscaling:e.target.checked})}/>Enable Autoscaling</label>
      <div className="flex gap-2"><button className="btn-primary flex-1" onClick={create}>Create</button><button className="btn-secondary flex-1" onClick={()=>setShow(false)}>Cancel</button></div>
    </div></div>}
  </div>);
}
