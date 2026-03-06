"use client";
import { useState, useEffect } from "react";
import { useStore } from "../store";
import { CloudArmorApi } from "../lib/apiClient";
import { Shield, Plus, Trash2 } from "lucide-react";
const TYPES = ["CLOUD_ARMOR","CLOUD_ARMOR_EDGE"];
const ACTIONS = ["allow","deny(403)","deny(404)","deny(502)"];
export function CloudArmorPanel() {
  const projectId = useStore(s=>s.projectId); const addToast = useStore(s=>s.addToast);
  const [policies, setPolicies] = useState<any[]>([]); const [loading, setLoading] = useState(false); const [show, setShow] = useState(false);
  const [form, setForm] = useState({ name:"", description:"", type:"CLOUD_ARMOR", defaultAction:"allow", adaptiveProtection:false });
  const load = async()=>{ if(!projectId) return; setLoading(true); try{setPolicies(await CloudArmorApi.list(projectId))}catch(e:any){addToast(e.message,"error")}finally{setLoading(false)} };
  useEffect(()=>{load()},[projectId]);
  const create = async()=>{ if(!projectId) return; try{await CloudArmorApi.create(projectId,form);addToast("Policy created","success");setShow(false);load()}catch(e:any){addToast(e.message,"error")} };
  const del = async(id:string)=>{ if(!projectId) return; try{await CloudArmorApi.delete(projectId,id);addToast("Deleted","success");load()}catch(e:any){addToast(e.message,"error")} };
  return(<div className="p-6 space-y-6">
    <div className="flex items-center justify-between"><h1 className="text-xl font-semibold flex items-center gap-2"><Shield className="w-5 h-5 text-gcp-blue"/>Cloud Armor</h1>
      <button className="btn-primary flex items-center gap-1" onClick={()=>setShow(true)}><Plus className="w-4 h-4"/>Create Policy</button></div>
    {loading?<div className="text-center py-8 text-gcp-muted">Loading...</div>:policies.length===0?<p className="text-gcp-muted text-center py-8">No Cloud Armor policies yet.</p>:
    <div className="space-y-3">{policies.map((p:any)=><div key={p.id} className="card p-4 flex items-center justify-between">
      <div><div className="font-medium flex items-center gap-2"><Shield className="w-4 h-4 text-green-600"/>{p.name}</div>
        <div className="text-xs text-gcp-muted mt-1">{p.type} · Default: {p.defaultAction} · {(p.rules||[]).length} rules{p.adaptiveProtection?" · Adaptive Protection":""}</div></div>
      <button onClick={()=>del(p.id)} className="text-gcp-red hover:bg-red-50 p-1 rounded"><Trash2 className="w-4 h-4"/></button></div>)}</div>}
    {show&&<div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"><div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md space-y-4">
      <h2 className="text-lg font-semibold">Create Cloud Armor Policy</h2>
      <input className="input-field" placeholder="Policy name" value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/>
      <input className="input-field" placeholder="Description" value={form.description} onChange={e=>setForm({...form,description:e.target.value})}/>
      <select className="input-field" value={form.type} onChange={e=>setForm({...form,type:e.target.value})}>{TYPES.map(t=><option key={t}>{t}</option>)}</select>
      <select className="input-field" value={form.defaultAction} onChange={e=>setForm({...form,defaultAction:e.target.value})}>{ACTIONS.map(a=><option key={a}>{a}</option>)}</select>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.adaptiveProtection} onChange={e=>setForm({...form,adaptiveProtection:e.target.checked})}/>Enable Adaptive Protection</label>
      <div className="flex gap-2"><button className="btn-primary flex-1" onClick={create}>Create</button><button className="btn-secondary flex-1" onClick={()=>setShow(false)}>Cancel</button></div>
    </div></div>}
  </div>);
}
