"use client";
import { useState, useEffect } from "react";
import { useStore } from "../store";
import { ArtifactRegistry as ARApi } from "../lib/apiClient";
import { Package, Plus, Trash2 } from "lucide-react";
const FORMATS = ["DOCKER","NPM","PYTHON","MAVEN","APT","GO"];
const LOCATIONS = ["us-central1","us-east1","europe-west1","asia-east1"];
const FORMAT_COLORS: Record<string,string> = { DOCKER:"bg-blue-100 text-blue-700",NPM:"bg-red-100 text-red-700",PYTHON:"bg-yellow-100 text-yellow-700",MAVEN:"bg-orange-100 text-orange-700",APT:"bg-green-100 text-green-700",GO:"bg-cyan-100 text-cyan-700"};
export function ArtifactRegistryPanel() {
  const projectId = useStore(s=>s.projectId); const addToast = useStore(s=>s.addToast);
  const [repos, setRepos] = useState<any[]>([]); const [loading, setLoading] = useState(false); const [show, setShow] = useState(false);
  const [form, setForm] = useState({ name:"", format:"DOCKER", location:"us-central1", description:"" });
  const load = async()=>{ if(!projectId) return; setLoading(true); try{setRepos(await ARApi.list(projectId))}catch(e:any){addToast(e.message,"error")}finally{setLoading(false)} };
  useEffect(()=>{load()},[projectId]);
  const create = async()=>{ if(!projectId) return; try{await ARApi.create(projectId,form);addToast("Repository created","success");setShow(false);load()}catch(e:any){addToast(e.message,"error")} };
  const del = async(id:string)=>{ if(!projectId) return; try{await ARApi.delete(projectId,id);addToast("Deleted","success");load()}catch(e:any){addToast(e.message,"error")} };
  return(<div className="p-6 space-y-6">
    <div className="flex items-center justify-between"><h1 className="text-xl font-semibold flex items-center gap-2"><Package className="w-5 h-5 text-gcp-blue"/>Artifact Registry</h1>
      <button className="btn-primary flex items-center gap-1" onClick={()=>setShow(true)}><Plus className="w-4 h-4"/>Create Repository</button></div>
    {loading?<div className="text-center py-8 text-gcp-muted">Loading...</div>:repos.length===0?<p className="text-gcp-muted text-center py-8">No repositories yet.</p>:
    <div className="grid gap-3">{repos.map((r:any)=><div key={r.id} className="card p-4 flex items-center justify-between">
      <div><div className="font-medium">{r.name}</div><div className="text-xs text-gcp-muted mt-1">{r.location} · {r.packageCount} packages{r.description?` · ${r.description}`:""}</div></div>
      <div className="flex items-center gap-2"><span className={`px-2 py-0.5 text-xs rounded-full font-medium ${FORMAT_COLORS[r.format]||""}`}>{r.format}</span>
        <button onClick={()=>del(r.id)} className="text-gcp-red hover:bg-red-50 p-1 rounded"><Trash2 className="w-4 h-4"/></button></div></div>)}</div>}
    {show&&<div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"><div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md space-y-4">
      <h2 className="text-lg font-semibold">Create Repository</h2>
      <input className="input-field" placeholder="Repository name" value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/>
      <select className="input-field" value={form.format} onChange={e=>setForm({...form,format:e.target.value})}>{FORMATS.map(f=><option key={f}>{f}</option>)}</select>
      <select className="input-field" value={form.location} onChange={e=>setForm({...form,location:e.target.value})}>{LOCATIONS.map(l=><option key={l}>{l}</option>)}</select>
      <input className="input-field" placeholder="Description (optional)" value={form.description} onChange={e=>setForm({...form,description:e.target.value})}/>
      <div className="flex gap-2"><button className="btn-primary flex-1" onClick={create}>Create</button><button className="btn-secondary flex-1" onClick={()=>setShow(false)}>Cancel</button></div>
    </div></div>}
  </div>);
}
