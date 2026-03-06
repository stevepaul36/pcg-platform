"use client";
import { useState, useEffect } from "react";
import { useStore } from "../store";
import { MemorystoreApi } from "../lib/apiClient";
import { Database, Plus, Trash2 } from "lucide-react";
const ENGINES = ["REDIS","MEMCACHED"];
const VERSIONS: Record<string,string[]> = { REDIS:["REDIS_7_0","REDIS_6_X"], MEMCACHED:["MEMCACHE_1_6"] };
const TIERS = ["BASIC","STANDARD_HA"];
const REGIONS = ["us-central1","us-east1","europe-west1","asia-east1"];
const STATUS_COLORS: Record<string,string> = { READY:"bg-green-100 text-green-700",CREATING:"bg-yellow-100 text-yellow-700",UPDATING:"bg-blue-100 text-blue-700",DELETING:"bg-orange-100 text-orange-700",FAILED:"bg-red-100 text-red-700"};
export function MemorystorePanel() {
  const projectId = useStore(s=>s.projectId); const addToast = useStore(s=>s.addToast);
  const [instances, setInstances] = useState<any[]>([]); const [loading, setLoading] = useState(false); const [show, setShow] = useState(false);
  const [form, setForm] = useState({ name:"", engine:"REDIS", version:"REDIS_7_0", tier:"BASIC", memorySizeGb:1, region:"us-central1" });
  const load = async()=>{ if(!projectId) return; setLoading(true); try{setInstances(await MemorystoreApi.list(projectId))}catch(e:any){addToast(e.message,"error")}finally{setLoading(false)} };
  useEffect(()=>{load()},[projectId]);
  const create = async()=>{ if(!projectId) return; try{await MemorystoreApi.create(projectId,form);addToast("Instance creating...","success");setShow(false);setTimeout(load,3500)}catch(e:any){addToast(e.message,"error")} };
  const del = async(id:string)=>{ if(!projectId) return; try{await MemorystoreApi.delete(projectId,id);addToast("Deleted","success");load()}catch(e:any){addToast(e.message,"error")} };
  return(<div className="p-6 space-y-6">
    <div className="flex items-center justify-between"><h1 className="text-xl font-semibold flex items-center gap-2"><Database className="w-5 h-5 text-gcp-blue"/>Memorystore</h1>
      <button className="btn-primary flex items-center gap-1" onClick={()=>setShow(true)}><Plus className="w-4 h-4"/>Create Instance</button></div>
    {loading?<div className="text-center py-8 text-gcp-muted">Loading...</div>:instances.length===0?<p className="text-gcp-muted text-center py-8">No Memorystore instances yet.</p>:
    <div className="space-y-3">{instances.map((i:any)=><div key={i.id} className="card p-4 flex items-center justify-between">
      <div><div className="font-medium">{i.name}</div><div className="text-xs text-gcp-muted mt-1">{i.engine} {i.version} · {i.tier} · {i.memorySizeGb}GB · {i.region}</div>
        <div className="text-xs text-gcp-muted">{i.host}:{i.port} · ${i.hourlyCost?.toFixed(3)}/hr</div></div>
      <div className="flex items-center gap-2"><span className={`px-2 py-0.5 text-xs rounded-full ${STATUS_COLORS[i.status]||""}`}>{i.status}</span>
        <button onClick={()=>del(i.id)} className="text-gcp-red hover:bg-red-50 p-1 rounded"><Trash2 className="w-4 h-4"/></button></div></div>)}</div>}
    {show&&<div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"><div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md space-y-4">
      <h2 className="text-lg font-semibold">Create Memorystore Instance</h2>
      <input className="input-field" placeholder="Instance name" value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/>
      <select className="input-field" value={form.engine} onChange={e=>{const eng=e.target.value;setForm({...form,engine:eng,version:VERSIONS[eng][0]})}}>{ENGINES.map(e=><option key={e}>{e}</option>)}</select>
      <select className="input-field" value={form.version} onChange={e=>setForm({...form,version:e.target.value})}>{(VERSIONS[form.engine]||[]).map(v=><option key={v}>{v}</option>)}</select>
      <select className="input-field" value={form.tier} onChange={e=>setForm({...form,tier:e.target.value})}>{TIERS.map(t=><option key={t}>{t}</option>)}</select>
      <input className="input-field" type="number" min="1" max="300" placeholder="Memory (GB)" value={form.memorySizeGb} onChange={e=>setForm({...form,memorySizeGb:+e.target.value})}/>
      <select className="input-field" value={form.region} onChange={e=>setForm({...form,region:e.target.value})}>{REGIONS.map(r=><option key={r}>{r}</option>)}</select>
      <div className="flex gap-2"><button className="btn-primary flex-1" onClick={create}>Create</button><button className="btn-secondary flex-1" onClick={()=>setShow(false)}>Cancel</button></div>
    </div></div>}
  </div>);
}
