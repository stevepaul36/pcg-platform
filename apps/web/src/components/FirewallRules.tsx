"use client";
import { useState, useEffect } from "react";
import { useStore } from "../store";
import { FirewallApi, formatApiError } from "../lib/apiClient";
import { ShieldAlert, Plus, Trash2 } from "lucide-react";
const COMMON_PROTOCOLS = ["tcp:80","tcp:443","tcp:22","tcp:3389","udp:53","icmp"];
export function FirewallRulesPanel() {
  const projectId = useStore(s=>s.projectId); const addToast = useStore(s=>s.addToast);
  const [items, setItems] = useState<any[]>([]); const [loading, setLoading] = useState(false); const [show, setShow] = useState(false);
  const [form, setForm] = useState({ name:"", direction:"INGRESS", action:"ALLOW", priority:1000, sourceRanges:"0.0.0.0/0", targetTags:"", protocols:["tcp:80","tcp:443"] as string[] });
  const load = async()=>{ if(!projectId) return; setLoading(true); try{setItems(await FirewallApi.list(projectId))}catch(e:any){addToast(formatApiError(e),"error")}finally{setLoading(false)} };
  useEffect(()=>{load()},[projectId]);
  const create = async()=>{ if(!projectId) return;
    const payload = {
      name: form.name, direction: form.direction, action: form.action, priority: form.priority,
      sourceRanges: form.sourceRanges.split(",").map(s=>s.trim()).filter(Boolean),
      targetTags: form.targetTags ? form.targetTags.split(",").map(s=>s.trim()).filter(Boolean) : [],
      protocols: form.protocols,
    };
    try{await FirewallApi.create(projectId,payload);addToast("Firewall rule created","success");setShow(false);load()}catch(e:any){addToast(formatApiError(e),"error")} };
  const del = async(id:string)=>{ if(!projectId) return; try{await FirewallApi.delete(projectId,id);addToast("Deleted","success");load()}catch(e:any){addToast(formatApiError(e),"error")} };
  const toggleProtocol = (proto:string) => {
    setForm(f => ({...f, protocols: f.protocols.includes(proto) ? f.protocols.filter(p=>p!==proto) : [...f.protocols, proto]}));
  };
  return(<div className="p-6 space-y-6">
    <div className="flex items-center justify-between"><h1 className="text-xl font-semibold flex items-center gap-2"><ShieldAlert className="w-5 h-5 text-gcp-blue"/>Firewall Rules</h1>
      <button className="btn-primary flex items-center gap-1" onClick={()=>setShow(true)}><Plus className="w-4 h-4"/>Create Rule</button></div>
    {loading?<div className="text-center py-8 text-gcp-muted">Loading...</div>:items.length===0?<p className="text-gcp-muted text-center py-8">No firewall rules yet.</p>:
    <div className="space-y-3">{items.map((i:any)=><div key={i.id} className="card p-4 flex items-center justify-between">
      <div><div className="font-medium">{i.name}</div>
        <div className="text-xs text-gcp-muted mt-1">{`${i.direction} · ${i.action} · priority ${i.priority} · ${(i.protocols||[]).join(", ")}`}</div>
        <div className="text-xs text-gcp-muted">{`Sources: ${(i.sourceRanges||[]).join(", ")} · Tags: ${(i.targetTags||[]).join(", ")||"none"}`}</div></div>
      <div className="flex items-center gap-2">
        <span className={`px-2 py-0.5 text-xs rounded-full ${i.enabled!==false?"bg-green-100 text-green-700":"bg-gray-100 text-gray-600"}`}>{i.enabled!==false?"Enabled":"Disabled"}</span>
        <button onClick={()=>del(i.id)} className="text-gcp-red hover:bg-red-50 p-1 rounded"><Trash2 className="w-4 h-4"/></button></div></div>)}</div>}
    {show&&<div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"><div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md space-y-4 max-h-[90vh] overflow-y-auto">
      <h2 className="text-lg font-semibold">Create Firewall Rule</h2>
      <input className="input-field" placeholder="Rule name" value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/>
      <p className="text-xs text-gcp-muted mt-0.5">Lowercase letters, digits, hyphens (e.g. allow-https)</p>
      <div className="grid grid-cols-2 gap-2">
        <select className="input-field" value={form.direction} onChange={e=>setForm({...form,direction:e.target.value})}><option value="INGRESS">INGRESS</option><option value="EGRESS">EGRESS</option></select>
        <select className="input-field" value={form.action} onChange={e=>setForm({...form,action:e.target.value})}><option value="ALLOW">ALLOW</option><option value="DENY">DENY</option></select>
      </div>
      <input className="input-field" type="number" placeholder="Priority (0-65535)" value={form.priority} onChange={e=>setForm({...form,priority:+e.target.value})}/>
      <div><label className="text-xs font-medium text-gcp-muted mb-1 block">Protocols & Ports</label>
        <div className="flex flex-wrap gap-2">{COMMON_PROTOCOLS.map(p=>
          <button key={p} onClick={()=>toggleProtocol(p)} className={`px-2 py-1 text-xs rounded border ${form.protocols.includes(p)?"bg-gcp-blue text-white border-gcp-blue":"bg-white border-gray-300 hover:bg-gray-50"}`}>{p}</button>
        )}</div></div>
      <input className="input-field" placeholder="Source ranges (comma-separated)" value={form.sourceRanges} onChange={e=>setForm({...form,sourceRanges:e.target.value})}/>
      <input className="input-field" placeholder="Target tags (comma-separated, optional)" value={form.targetTags} onChange={e=>setForm({...form,targetTags:e.target.value})}/>
      <div className="flex gap-2"><button className="btn-primary flex-1" onClick={create}>Create</button><button className="btn-secondary flex-1" onClick={()=>setShow(false)}>Cancel</button></div>
    </div></div>}
  </div>);
}
