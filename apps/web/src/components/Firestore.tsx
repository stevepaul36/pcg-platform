"use client";
import { useState, useEffect } from "react";
import { useStore } from "../store";
import { FirestoreApi } from "../lib/apiClient";
import { Flame, Plus, Trash2 } from "lucide-react";
export function FirestorePanel() {
  const projectId = useStore(s=>s.projectId); const addToast = useStore(s=>s.addToast);
  const [items, setItems] = useState<any[]>([]); const [loading, setLoading] = useState(false); const [show, setShow] = useState(false);
  const [form, setForm] = useState<any>({ "name":"", "locationId":"us-central1", "type":"NATIVE" });
  const load = async()=>{ if(!projectId) return; setLoading(true); try{setItems(await FirestoreApi.list(projectId))}catch(e:any){addToast(e.message,"error")}finally{setLoading(false)} };
  useEffect(()=>{load()},[projectId]);
  const create = async()=>{ if(!projectId) return; try{await FirestoreApi.create(projectId,form);addToast("Firestore Database created","success");setShow(false);load()}catch(e:any){addToast(e.message,"error")} };
  const del = async(id:string)=>{ if(!projectId) return; try{await FirestoreApi.delete(projectId,id);addToast("Deleted","success");load()}catch(e:any){addToast(e.message,"error")} };
  return(<div className="p-6 space-y-6">
    <div className="flex items-center justify-between"><h1 className="text-xl font-semibold flex items-center gap-2"><Flame className="w-5 h-5 text-gcp-blue"/>Firestore Databases</h1>
      <button className="btn-primary flex items-center gap-1" onClick={()=>setShow(true)}><Plus className="w-4 h-4"/>Create</button></div>
    {loading?<div className="text-center py-8 text-gcp-muted">Loading...</div>:items.length===0?<p className="text-gcp-muted text-center py-8">No firestore databases yet.</p>:
    <div className="space-y-3">{items.map((i:any)=><div key={i.id} className="card p-4 flex items-center justify-between">
      <div><div className="font-medium">{i.name||i.displayName}</div><div className="text-xs text-gcp-muted mt-1">{`${i.type} · ${i.locationId}`}</div></div>
      <div className="flex items-center gap-2">{i.status&&<span className={`px-2 py-0.5 text-xs rounded-full ${i.status==="RUNNING"||i.status==="ACTIVE"||i.status==="ON_TRACK"?"bg-green-100 text-green-700":i.status==="CREATING"||i.status==="PAUSED"||i.status==="WARNING"?"bg-yellow-100 text-yellow-700":"bg-gray-100 text-gray-600"}`}>{i.status}</span>}
        <button onClick={()=>del(i.id)} className="text-gcp-red hover:bg-red-50 p-1 rounded"><Trash2 className="w-4 h-4"/></button></div></div>)}</div>}
    {show&&<div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"><div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md space-y-4">
      <h2 className="text-lg font-semibold">Create Firestore Database</h2>
      <input className="input-field" placeholder="Database name" value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/>
      <select className="input-field" value={form.locationId} onChange={e=>setForm({...form,locationId:e.target.value})}><option key="us-central1" value="us-central1">us-central1</option><option key="us-east1" value="us-east1">us-east1</option><option key="europe-west1" value="europe-west1">europe-west1</option><option key="asia-east1" value="asia-east1">asia-east1</option></select>
      <select className="input-field" value={form.type} onChange={e=>setForm({...form,type:e.target.value})}><option key="NATIVE" value="NATIVE">NATIVE</option><option key="DATASTORE" value="DATASTORE">DATASTORE</option></select>
      <div className="flex gap-2"><button className="btn-primary flex-1" onClick={create}>Create</button><button className="btn-secondary flex-1" onClick={()=>setShow(false)}>Cancel</button></div>
    </div></div>}
  </div>);
}
