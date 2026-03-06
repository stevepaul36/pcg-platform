"use client";
import { useState, useEffect } from "react";
import { useStore } from "../store";
import { CloudBuild as CBApi } from "../lib/apiClient";
import { Hammer, Plus, Trash2, GitBranch } from "lucide-react";
const STATUS_COLORS: Record<string,string> = { ACTIVE:"bg-green-100 text-green-700", DISABLED:"bg-gray-100 text-gray-600", NONE:"bg-gray-100 text-gray-500", SUCCESS:"bg-green-100 text-green-700", FAILURE:"bg-red-100 text-red-700", WORKING:"bg-yellow-100 text-yellow-700", QUEUED:"bg-blue-100 text-blue-700" };
export function CloudBuildPanel() {
  const projectId = useStore(s=>s.projectId); const addToast = useStore(s=>s.addToast);
  const [triggers, setTriggers] = useState<any[]>([]); const [loading, setLoading] = useState(false); const [show, setShow] = useState(false);
  const [form, setForm] = useState({ name:"", description:"", repoSource:"", branchPattern:"^main$", buildSteps:["docker build -t gcr.io/PROJECT/app .","docker push gcr.io/PROJECT/app"] });
  const load = async()=>{ if(!projectId) return; setLoading(true); try{setTriggers(await CBApi.list(projectId))}catch(e:any){addToast(e.message,"error")}finally{setLoading(false)} };
  useEffect(()=>{load()},[projectId]);
  const create = async()=>{ if(!projectId) return; try{await CBApi.create(projectId,form);addToast("Build trigger created","success");setShow(false);load()}catch(e:any){addToast(e.message,"error")} };
  const del = async(id:string)=>{ if(!projectId) return; try{await CBApi.delete(projectId,id);addToast("Deleted","success");load()}catch(e:any){addToast(e.message,"error")} };
  return(<div className="p-6 space-y-6">
    <div className="flex items-center justify-between"><h1 className="text-xl font-semibold flex items-center gap-2"><Hammer className="w-5 h-5 text-gcp-blue"/>Cloud Build</h1>
      <button className="btn-primary flex items-center gap-1" onClick={()=>setShow(true)}><Plus className="w-4 h-4"/>Create Trigger</button></div>
    {loading?<div className="text-center py-8 text-gcp-muted">Loading...</div>:triggers.length===0?<p className="text-gcp-muted text-center py-8">No build triggers yet.</p>:
    <div className="space-y-3">{triggers.map((t:any)=><div key={t.id} className="card p-4 flex items-center justify-between">
      <div><div className="font-medium flex items-center gap-2"><GitBranch className="w-4 h-4 text-purple-500"/>{t.name}</div>
        <div className="text-xs text-gcp-muted mt-1">{t.repoSource} · {t.branchPattern} · {t.buildSteps?.length||0} steps</div></div>
      <div className="flex items-center gap-2"><span className={`px-2 py-0.5 text-xs rounded-full ${STATUS_COLORS[t.lastBuildStatus]||""}`}>{t.lastBuildStatus}</span>
        <span className={`px-2 py-0.5 text-xs rounded-full ${STATUS_COLORS[t.status]||""}`}>{t.status}</span>
        <button onClick={()=>del(t.id)} className="text-gcp-red hover:bg-red-50 p-1 rounded"><Trash2 className="w-4 h-4"/></button></div></div>)}</div>}
    {show&&<div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"><div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md space-y-4">
      <h2 className="text-lg font-semibold">Create Build Trigger</h2>
      <input className="input-field" placeholder="Trigger name" value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/>
      <input className="input-field" placeholder="Repository (github.com/user/repo)" value={form.repoSource} onChange={e=>setForm({...form,repoSource:e.target.value})}/>
      <input className="input-field" placeholder="Branch pattern" value={form.branchPattern} onChange={e=>setForm({...form,branchPattern:e.target.value})}/>
      <textarea className="input-field h-24" placeholder="Build steps (one per line)" value={form.buildSteps.join("\n")} onChange={e=>setForm({...form,buildSteps:e.target.value.split("\n").filter(Boolean)})}/>
      <div className="flex gap-2"><button className="btn-primary flex-1" onClick={create}>Create</button><button className="btn-secondary flex-1" onClick={()=>setShow(false)}>Cancel</button></div>
    </div></div>}
  </div>);
}
