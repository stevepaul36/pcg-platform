"use client";
import { useState, useEffect } from "react";
import { useStore } from "../store";
import { DeployApi, formatApiError } from "../lib/apiClient";
import { Rocket, Plus, Trash2, PlusCircle, X } from "lucide-react";
export function CloudDeployPanelPanel() {
  const projectId = useStore(s=>s.projectId); const addToast = useStore(s=>s.addToast);
  const [items, setItems] = useState<any[]>([]); const [loading, setLoading] = useState(false); const [show, setShow] = useState(false);
  const [form, setForm] = useState<any>({ name:"", region:"us-central1", description:"", stages:[{name:"dev",targetId:"dev-cluster",profiles:[]}] });
  const load = async()=>{ if(!projectId) return; setLoading(true); try{setItems(await DeployApi.list(projectId))}catch(e:any){addToast(formatApiError(e),"error")}finally{setLoading(false)} };
  useEffect(()=>{load()},[projectId]);
  const create = async()=>{ if(!projectId) return; try{await DeployApi.create(projectId,form);addToast("Pipeline created","success");setShow(false);setForm({name:"",region:"us-central1",description:"",stages:[{name:"dev",targetId:"dev-cluster",profiles:[]}]});load()}catch(e:any){addToast(formatApiError(e),"error")} };
  const del = async(id:string)=>{ if(!projectId) return; try{await DeployApi.delete(projectId,id);addToast("Deleted","success");load()}catch(e:any){addToast(formatApiError(e),"error")} };
  const addStage = () => setForm({...form, stages:[...form.stages, {name:"",targetId:"",profiles:[]}]});
  const removeStage = (idx:number) => setForm({...form, stages: form.stages.filter((_:any,i:number)=>i!==idx)});
  const updateStage = (idx:number, field:string, val:string) => {
    const stages = [...form.stages];
    stages[idx] = {...stages[idx], [field]: val};
    setForm({...form, stages});
  };
  return(<div className="p-6 space-y-6">
    <div className="flex items-center justify-between"><h1 className="text-xl font-semibold flex items-center gap-2"><Rocket className="w-5 h-5 text-gcp-blue"/>Cloud Deploy</h1>
      <button className="btn-primary flex items-center gap-1" onClick={()=>setShow(true)}><Plus className="w-4 h-4"/>Create Pipeline</button></div>
    {loading?<div className="text-center py-8 text-gcp-muted">Loading...</div>:items.length===0?<p className="text-gcp-muted text-center py-8">No pipelines yet.</p>:
    <div className="space-y-3">{items.map((i:any)=><div key={i.id} className="card p-4 flex items-center justify-between">
      <div><div className="font-medium">{i.name}</div><div className="text-xs text-gcp-muted mt-1">{`${i.region} · ${(i.stages||[]).length} stages · ${i.lastDeployStatus}`}</div></div>
      <div className="flex items-center gap-2">{i.status&&<span className={`px-2 py-0.5 text-xs rounded-full ${i.status==="ACTIVE"?"bg-green-100 text-green-700":"bg-gray-100 text-gray-600"}`}>{i.status}</span>}
        <button onClick={()=>del(i.id)} className="text-gcp-red hover:bg-red-50 p-1 rounded"><Trash2 className="w-4 h-4"/></button></div></div>)}</div>}
    {show&&<div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"><div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-lg space-y-4 max-h-[90vh] overflow-y-auto">
      <h2 className="text-lg font-semibold">Create Delivery Pipeline</h2>
      <input className="input-field" placeholder="Pipeline name" value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/>
      <p className="text-xs text-gcp-muted mt-0.5">Lowercase letters, digits, hyphens (e.g. my-pipeline)</p>
      <select className="input-field" value={form.region} onChange={e=>setForm({...form,region:e.target.value})}>
        <option value="us-central1">us-central1</option><option value="us-east1">us-east1</option>
        <option value="europe-west1">europe-west1</option><option value="asia-east1">asia-east1</option></select>
      <input className="input-field" placeholder="Description" value={form.description} onChange={e=>setForm({...form,description:e.target.value})}/>
      <div className="space-y-2">
        <div className="flex items-center justify-between"><span className="text-sm font-medium">Stages</span>
          <button onClick={addStage} className="text-gcp-blue text-xs flex items-center gap-1"><PlusCircle className="w-3 h-3"/>Add Stage</button></div>
        {form.stages.map((stage:any, idx:number)=>(
          <div key={idx} className="flex gap-2 items-center">
            <input className="input-field flex-1" placeholder="Stage name (e.g. dev, staging, prod)" value={stage.name} onChange={e=>updateStage(idx,"name",e.target.value)}/>
            <input className="input-field flex-1" placeholder="Target ID (e.g. gke-prod)" value={stage.targetId} onChange={e=>updateStage(idx,"targetId",e.target.value)}/>
            {form.stages.length>1&&<button onClick={()=>removeStage(idx)} className="text-gcp-red p-1"><X className="w-4 h-4"/></button>}
          </div>))}
      </div>
      <div className="flex gap-2"><button className="btn-primary flex-1" onClick={create}>Create</button><button className="btn-secondary flex-1" onClick={()=>setShow(false)}>Cancel</button></div>
    </div></div>}
  </div>);
}
