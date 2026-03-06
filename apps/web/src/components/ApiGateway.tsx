"use client";
import { useState, useEffect } from "react";
import { useStore } from "../store";
import { ApiGatewayApi } from "../lib/apiClient";
import { Waypoints, Plus, Trash2 } from "lucide-react";
const REGIONS = ["us-central1","us-east1","europe-west1","asia-east1"];
const PROTOCOLS = ["HTTP","HTTPS","GRPC"];
const AUTH_TYPES = ["API_KEY","JWT","NONE"];
export function ApiGatewayPanel() {
  const projectId = useStore(s=>s.projectId); const addToast = useStore(s=>s.addToast);
  const [gws, setGws] = useState<any[]>([]); const [loading, setLoading] = useState(false); const [show, setShow] = useState(false);
  const [form, setForm] = useState({ name:"", displayName:"", backendUrl:"", region:"us-central1", protocol:"HTTPS", authType:"API_KEY", rateLimitRpm:1000 });
  const load = async()=>{ if(!projectId) return; setLoading(true); try{setGws(await ApiGatewayApi.list(projectId))}catch(e:any){addToast(e.message,"error")}finally{setLoading(false)} };
  useEffect(()=>{load()},[projectId]);
  const create = async()=>{ if(!projectId) return; try{await ApiGatewayApi.create(projectId,form);addToast("API Gateway created","success");setShow(false);load()}catch(e:any){addToast(e.message,"error")} };
  const del = async(id:string)=>{ if(!projectId) return; try{await ApiGatewayApi.delete(projectId,id);addToast("Deleted","success");load()}catch(e:any){addToast(e.message,"error")} };
  return(<div className="p-6 space-y-6">
    <div className="flex items-center justify-between"><h1 className="text-xl font-semibold flex items-center gap-2"><Waypoints className="w-5 h-5 text-gcp-blue"/>API Gateway</h1>
      <button className="btn-primary flex items-center gap-1" onClick={()=>setShow(true)}><Plus className="w-4 h-4"/>Create Gateway</button></div>
    {loading?<div className="text-center py-8 text-gcp-muted">Loading...</div>:gws.length===0?<p className="text-gcp-muted text-center py-8">No API gateways yet.</p>:
    <div className="space-y-3">{gws.map((g:any)=><div key={g.id} className="card p-4 flex items-center justify-between">
      <div><div className="font-medium">{g.displayName}</div><div className="text-xs text-gcp-muted mt-1">{g.protocol} · {g.authType} · {g.rateLimitRpm} RPM · {g.region}</div>
        {g.gatewayUrl&&<div className="text-xs text-gcp-blue mt-0.5">{g.gatewayUrl}</div>}</div>
      <div className="flex items-center gap-2"><span className={`px-2 py-0.5 text-xs rounded-full ${g.status==="ACTIVE"?"bg-green-100 text-green-700":"bg-yellow-100 text-yellow-700"}`}>{g.status}</span>
        <button onClick={()=>del(g.id)} className="text-gcp-red hover:bg-red-50 p-1 rounded"><Trash2 className="w-4 h-4"/></button></div></div>)}</div>}
    {show&&<div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"><div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md space-y-4">
      <h2 className="text-lg font-semibold">Create API Gateway</h2>
      <input className="input-field" placeholder="Gateway name" value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/>
      <input className="input-field" placeholder="Display name" value={form.displayName} onChange={e=>setForm({...form,displayName:e.target.value})}/>
      <input className="input-field" placeholder="Backend URL (https://...)" value={form.backendUrl} onChange={e=>setForm({...form,backendUrl:e.target.value})}/>
      <select className="input-field" value={form.region} onChange={e=>setForm({...form,region:e.target.value})}>{REGIONS.map(r=><option key={r}>{r}</option>)}</select>
      <select className="input-field" value={form.authType} onChange={e=>setForm({...form,authType:e.target.value})}>{AUTH_TYPES.map(a=><option key={a}>{a}</option>)}</select>
      <input className="input-field" type="number" placeholder="Rate limit RPM" value={form.rateLimitRpm} onChange={e=>setForm({...form,rateLimitRpm:+e.target.value})}/>
      <div className="flex gap-2"><button className="btn-primary flex-1" onClick={create}>Create</button><button className="btn-secondary flex-1" onClick={()=>setShow(false)}>Cancel</button></div>
    </div></div>}
  </div>);
}
