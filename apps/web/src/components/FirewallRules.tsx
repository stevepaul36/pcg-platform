"use client";
import { useState, useEffect } from "react";
import { useStore } from "../store";
import { FirewallApi } from "../lib/apiClient";
import { ShieldAlert, Plus, Trash2 } from "lucide-react";
export function FirewallRulesPanel() {
  const projectId = useStore(s=>s.projectId); const addToast = useStore(s=>s.addToast);
  const [items, setItems] = useState<any[]>([]); const [loading, setLoading] = useState(false); const [show, setShow] = useState(false);
  const [form, setForm] = useState<any>({ "name":"", "direction":"INGRESS", "action":"ALLOW", "priority":1000 });
  const load = async()=>{ if(!projectId) return; setLoading(true); try{setItems(await FirewallApi.list(projectId))}catch(e:any){addToast(e.message,"error")}finally{setLoading(false)} };
  useEffect(()=>{load()},[projectId]);
  const create = async()=>{ if(!projectId) return; try{await FirewallApi.create(projectId,form);addToast("Firewall Rule created","success");setShow(false);load()}catch(e:any){addToast(e.message,"error")} };
  const del = async(id:string)=>{ if(!projectId) return; try{await FirewallApi.delete(projectId,id);addToast("Deleted","success");load()}catch(e:any){addToast(e.message,"error")} };
  return(<div className="p-6 space-y-6">
    <div className="flex items-center justify-between"><h1 className="text-xl font-semibold flex items-center gap-2"><ShieldAlert className="w-5 h-5 text-gcp-blue"/>Firewall Rules</h1>
      <button className="btn-primary flex items-center gap-1" onClick={()=>setShow(true)}><Plus className="w-4 h-4"/>Create</button></div>
    {loading?<div className="text-center py-8 text-gcp-muted">Loading...</div>:items.length===0?<p className="text-gcp-muted text-center py-8">No firewall rules yet.</p>:
    <div className="space-y-3">{items.map((i:any)=><div key={i.id} className="card p-4 flex items-center justify-between">
      <div><div className="font-medium">{i.name||i.displayName}</div><div className="text-xs text-gcp-muted mt-1">{`${i.direction} · ${i.action} · priority ${i.priority} · ${(i.protocols||[]).join(',')}`}</div></div>
      <div className="flex items-center gap-2">{i.status&&<span className={`px-2 py-0.5 text-xs rounded-full ${i.status==="RUNNING"||i.status==="ACTIVE"||i.status==="ON_TRACK"?"bg-green-100 text-green-700":i.status==="CREATING"||i.status==="PAUSED"||i.status==="WARNING"?"bg-yellow-100 text-yellow-700":"bg-gray-100 text-gray-600"}`}>{i.status}</span>}
        <button onClick={()=>del(i.id)} className="text-gcp-red hover:bg-red-50 p-1 rounded"><Trash2 className="w-4 h-4"/></button></div></div>)}</div>}
    {show&&<div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"><div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md space-y-4">
      <h2 className="text-lg font-semibold">Create Firewall Rule</h2>
      <input className="input-field" placeholder="Rule name" value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/>
      <select className="input-field" value={form.direction} onChange={e=>setForm({...form,direction:e.target.value})}><option key="INGRESS" value="INGRESS">INGRESS</option><option key="EGRESS" value="EGRESS">EGRESS</option></select>
      <select className="input-field" value={form.action} onChange={e=>setForm({...form,action:e.target.value})}><option key="ALLOW" value="ALLOW">ALLOW</option><option key="DENY" value="DENY">DENY</option></select>
      <input className="input-field" type="number" placeholder="Priority" value={form.priority} onChange={e=>setForm({...form,priority:+e.target.value})}/>
      <div className="flex gap-2"><button className="btn-primary flex-1" onClick={create}>Create</button><button className="btn-secondary flex-1" onClick={()=>setShow(false)}>Cancel</button></div>
    </div></div>}
  </div>);
}
