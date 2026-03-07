"use client";
import { useState, useEffect } from "react";
import { useStore } from "../store";
import { QuotasApi } from "../lib/apiClient";
import { Gauge } from "lucide-react";
export function QuotasPanel() {
  const projectId = useStore(s=>s.projectId); const addToast = useStore(s=>s.addToast);
  const [quotas, setQuotas] = useState<any[]>([]); const [loading, setLoading] = useState(false);
  const load = async()=>{ if(!projectId) return; setLoading(true); try{setQuotas(await QuotasApi.list(projectId))}catch(e:any){addToast(formatApiError(e),"error")}finally{setLoading(false)} };
  useEffect(()=>{load()},[projectId]);
  return(<div className="p-6 space-y-6">
    <h1 className="text-xl font-semibold flex items-center gap-2"><Gauge className="w-5 h-5 text-gcp-blue"/>Quotas & Limits</h1>
    {loading?<div className="text-center py-8 text-gcp-muted">Loading...</div>:
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">{quotas.map((q:any,i:number)=>{
      const pct = q.limitValue > 0 ? (q.currentUsage / q.limitValue) * 100 : 0;
      const color = pct >= 90 ? "bg-red-500" : pct >= 70 ? "bg-yellow-500" : "bg-green-500";
      return <div key={q.id||i} className="card p-4">
        <div className="flex items-center justify-between mb-2"><span className="text-sm font-medium">{q.resourceType.replace(/_/g," ")}</span><span className="text-xs text-gcp-muted">{q.currentUsage}/{q.limitValue}</span></div>
        <div className="w-full bg-gray-200 rounded-full h-2"><div className={`${color} h-2 rounded-full transition-all`} style={{width:`${Math.min(pct,100)}%`}}/></div>
        <div className="text-xs text-gcp-muted mt-1">{q.region}</div>
      </div>})}</div>}
  </div>);
}
