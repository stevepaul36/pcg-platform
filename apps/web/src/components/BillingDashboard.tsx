"use client";
import { useState, useEffect } from "react";
import { useStore } from "../store";
import { BillingApi } from "../lib/apiClient";
import { DollarSign, TrendingUp } from "lucide-react";
export function BillingDashboard() {
  const projectId = useStore(s=>s.projectId); const addToast = useStore(s=>s.addToast);
  const [summary, setSummary] = useState<any>(null); const [records, setRecords] = useState<any[]>([]); const [loading, setLoading] = useState(false);
  const load = async()=>{ if(!projectId) return; setLoading(true); try{
    const [s,c] = await Promise.all([BillingApi.summary(projectId), BillingApi.costs(projectId)]);
    setSummary(s); setRecords((c as any).records||[]);
  }catch(e:any){addToast(e.message,"error")}finally{setLoading(false)} };
  useEffect(()=>{load()},[projectId]);
  const cats = summary ? [
    {label:"Compute",val:summary.compute,color:"bg-blue-500"},
    {label:"Storage",val:summary.storage,color:"bg-green-500"},
    {label:"Database",val:summary.database,color:"bg-purple-500"},
    {label:"Network",val:summary.network,color:"bg-orange-500"},
    {label:"AI / ML",val:summary.ai,color:"bg-pink-500"},
    {label:"Analytics",val:summary.analytics,color:"bg-cyan-500"},
  ] : [];
  return(<div className="p-6 space-y-6">
    <h1 className="text-xl font-semibold flex items-center gap-2"><DollarSign className="w-5 h-5 text-gcp-blue"/>Billing Dashboard</h1>
    {loading?<div className="text-center py-8 text-gcp-muted">Loading...</div>:<>
    {summary&&<div className="card p-6"><div className="text-3xl font-bold text-gcp-blue">${summary.totalCost?.toFixed(4)}</div><div className="text-sm text-gcp-muted mt-1">Estimated total cost this session</div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-6">{cats.map(c=><div key={c.label} className="flex items-center gap-3"><div className={`w-3 h-3 rounded-full ${c.color}`}/><div><div className="text-xs text-gcp-muted">{c.label}</div><div className="font-medium">${c.val?.toFixed(4)}</div></div></div>)}</div>
    </div>}
    <div className="card p-4"><h2 className="font-medium mb-3 flex items-center gap-2"><TrendingUp className="w-4 h-4"/>Active Usage Records ({records.filter((r:any)=>r.status==="ACTIVE").length})</h2>
      {records.length===0?<p className="text-gcp-muted text-sm">No usage records yet. Create resources to start tracking costs.</p>:
      <div className="space-y-2">{records.slice(0,20).map((r:any)=><div key={r.id} className="flex items-center justify-between text-sm border-b border-gray-100 py-2">
        <div><span className="font-medium">{r.resourceName}</span><span className="text-gcp-muted ml-2">{r.resourceType}</span></div>
        <div className="flex items-center gap-4"><span className="text-xs text-gcp-muted">${r.costPerHour}/hr</span>
          <span className={`px-2 py-0.5 text-xs rounded-full ${r.status==="ACTIVE"?"bg-green-100 text-green-700":"bg-gray-100 text-gray-600"}`}>{r.status}</span></div></div>)}</div>}
    </div></>}
  </div>);
}
