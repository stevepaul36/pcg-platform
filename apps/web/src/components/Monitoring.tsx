"use client";
import { useState, useEffect } from "react";
import { useStore } from "../store";
import { Monitoring as MonApi } from "../lib/apiClient";
import { Bell, Plus, Trash2, Activity, Globe } from "lucide-react";

const CONDITION_TYPES = ["METRIC_THRESHOLD","METRIC_ABSENCE","UPTIME_CHECK"];
const METRICS = ["compute.googleapis.com/instance/cpu/utilization","compute.googleapis.com/instance/disk/read_bytes_count","cloudsql.googleapis.com/database/cpu/utilization","storage.googleapis.com/api/request_count"];
const INTERVALS = ["60s","300s","600s","900s"];
const REGIONS = ["USA","EUROPE","SOUTH_AMERICA","ASIA_PACIFIC"];

export function MonitoringPanel() {
  const projectId = useStore(s => s.projectId);
  const addToast = useStore(s => s.addToast);
  const [tab, setTab] = useState<"alerts"|"uptime">("alerts");
  const [alerts, setAlerts] = useState<any[]>([]);
  const [uptimes, setUptimes] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [alertForm, setAlertForm] = useState({ name:"", displayName:"", conditionType:"METRIC_THRESHOLD", metricType:METRICS[0], threshold:0.8, duration:"60s", notifyEmails:[""] });
  const [uptimeForm, setUptimeForm] = useState({ displayName:"", monitoredUrl:"", checkInterval:"60s", timeout:"10s", regions:["USA"] });

  const load = async () => { if(!projectId) return; setLoading(true); try { setAlerts(await MonApi.listAlerts(projectId)); setUptimes(await MonApi.listUptime(projectId)); } catch(e:any){addToast(e.message,"error")} finally{setLoading(false)} };
  useEffect(() => { load(); }, [projectId]);

  const createAlert = async () => { if(!projectId) return; try { await MonApi.createAlert(projectId, {...alertForm, notifyEmails: alertForm.notifyEmails.filter(Boolean)}); addToast("Alert policy created","success"); setShowCreate(false); load(); } catch(e:any){addToast(e.message,"error")} };
  const createUptime = async () => { if(!projectId) return; try { await MonApi.createUptime(projectId, uptimeForm); addToast("Uptime check created","success"); setShowCreate(false); load(); } catch(e:any){addToast(e.message,"error")} };
  const deleteAlert = async (id:string) => { if(!projectId) return; try { await MonApi.deleteAlert(projectId,id); addToast("Deleted","success"); load(); } catch(e:any){addToast(e.message,"error")} };
  const deleteUptime = async (id:string) => { if(!projectId) return; try { await MonApi.deleteUptime(projectId,id); addToast("Deleted","success"); load(); } catch(e:any){addToast(e.message,"error")} };

  return (<div className="p-6 space-y-6">
    <div className="flex items-center justify-between"><h1 className="text-xl font-semibold flex items-center gap-2"><Bell className="w-5 h-5 text-gcp-blue"/>Cloud Monitoring</h1>
      <button className="btn-primary flex items-center gap-1" onClick={()=>setShowCreate(true)}><Plus className="w-4 h-4"/>Create</button></div>
    <div className="flex gap-2">{(["alerts","uptime"] as const).map(t=><button key={t} onClick={()=>setTab(t)} className={`px-4 py-2 rounded-lg text-sm font-medium ${tab===t?"bg-gcp-blue text-white":"bg-gray-100 hover:bg-gray-200"}`}>{t==="alerts"?"Alert Policies":"Uptime Checks"}</button>)}</div>
    {loading?<div className="text-center py-8 text-gcp-muted">Loading...</div>:tab==="alerts"?
      <div className="space-y-3">{alerts.length===0?<p className="text-gcp-muted text-center py-8">No alert policies yet.</p>:alerts.map((a:any)=>
        <div key={a.id} className="card p-4 flex items-center justify-between"><div><div className="font-medium flex items-center gap-2"><Activity className="w-4 h-4 text-orange-500"/>{a.displayName}</div><div className="text-xs text-gcp-muted mt-1">{a.conditionType} · {a.metricType} · threshold: {a.threshold}</div></div>
          <div className="flex items-center gap-2"><span className={`px-2 py-0.5 text-xs rounded-full ${a.enabled?"bg-green-100 text-green-700":"bg-gray-100 text-gray-600"}`}>{a.enabled?"Enabled":"Disabled"}</span><button onClick={()=>deleteAlert(a.id)} className="text-gcp-red hover:bg-red-50 p-1 rounded"><Trash2 className="w-4 h-4"/></button></div></div>)}</div>:
      <div className="space-y-3">{uptimes.length===0?<p className="text-gcp-muted text-center py-8">No uptime checks yet.</p>:uptimes.map((u:any)=>
        <div key={u.id} className="card p-4 flex items-center justify-between"><div><div className="font-medium flex items-center gap-2"><Globe className="w-4 h-4 text-blue-500"/>{u.displayName}</div><div className="text-xs text-gcp-muted mt-1">{u.monitoredUrl} · every {u.checkInterval}</div></div>
          <div className="flex items-center gap-2"><span className={`px-2 py-0.5 text-xs rounded-full ${u.lastStatus==="OK"?"bg-green-100 text-green-700":"bg-red-100 text-red-700"}`}>{u.lastStatus}</span><button onClick={()=>deleteUptime(u.id)} className="text-gcp-red hover:bg-red-50 p-1 rounded"><Trash2 className="w-4 h-4"/></button></div></div>)}</div>}
    {showCreate&&<div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"><div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md space-y-4">
      <h2 className="text-lg font-semibold">{tab==="alerts"?"Create Alert Policy":"Create Uptime Check"}</h2>
      {tab==="alerts"?<><input className="input-field" placeholder="Policy name (lowercase)" value={alertForm.name} onChange={e=>setAlertForm({...alertForm,name:e.target.value})}/>
        <input className="input-field" placeholder="Display name" value={alertForm.displayName} onChange={e=>setAlertForm({...alertForm,displayName:e.target.value})}/>
        <select className="input-field" value={alertForm.conditionType} onChange={e=>setAlertForm({...alertForm,conditionType:e.target.value})}>{CONDITION_TYPES.map(c=><option key={c}>{c}</option>)}</select>
        <select className="input-field" value={alertForm.metricType} onChange={e=>setAlertForm({...alertForm,metricType:e.target.value})}>{METRICS.map(m=><option key={m}>{m}</option>)}</select>
        <input className="input-field" type="number" step="0.01" min="0" max="1" placeholder="Threshold" value={alertForm.threshold} onChange={e=>setAlertForm({...alertForm,threshold:+e.target.value})}/>
        <div className="flex gap-2"><button className="btn-primary flex-1" onClick={createAlert}>Create</button><button className="btn-secondary flex-1" onClick={()=>setShowCreate(false)}>Cancel</button></div></>:
      <><input className="input-field" placeholder="Display name" value={uptimeForm.displayName} onChange={e=>setUptimeForm({...uptimeForm,displayName:e.target.value})}/>
        <input className="input-field" placeholder="URL to monitor (https://...)" value={uptimeForm.monitoredUrl} onChange={e=>setUptimeForm({...uptimeForm,monitoredUrl:e.target.value})}/>
        <select className="input-field" value={uptimeForm.checkInterval} onChange={e=>setUptimeForm({...uptimeForm,checkInterval:e.target.value})}>{INTERVALS.map(i=><option key={i}>{i}</option>)}</select>
        <div className="flex gap-2"><button className="btn-primary flex-1" onClick={createUptime}>Create</button><button className="btn-secondary flex-1" onClick={()=>setShowCreate(false)}>Cancel</button></div></>}
    </div></div>}
  </div>);
}
