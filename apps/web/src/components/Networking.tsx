"use client";
import { useState, useEffect } from "react";
import { useStore } from "../store";
import { Networking as NetApi, formatApiError } from "../lib/apiClient";
import { Network, Globe, BalancerIcon, Plus, Trash2 } from "lucide-react";

const REGIONS = ["us-central1","us-east1","europe-west1","asia-east1","global"];

function Section({ title, icon: Icon, children }: any) {
  return (
    <div className="mb-8">
      <div className="flex items-center gap-2 mb-3">
        <Icon className="w-4 h-4 text-gcp-blue" />
        <h2 className="font-medium">{title}</h2>
      </div>
      {children}
    </div>
  );
}

export function NetworkingPanel() {
  const projectId = useStore(s => s.projectId);
  const addToast = useStore(s => s.addToast);
  const [vpcs, setVpcs] = useState<any[]>([]);
  const [lbs, setLbs] = useState<any[]>([]);
  const [dnsZones, setDnsZones] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreate, setShowCreate] = useState<"vpc"|"lb"|"dns"|null>(null);
  const [vpcForm, setVpcForm] = useState({ name: "", subnet: "10.0.0.0/20", region: "us-central1", mode: "AUTO" });
  const [lbForm, setLbForm] = useState({ name: "", type: "HTTP", region: "global", backends: 1 });
  const [dnsForm, setDnsForm] = useState({ name: "", dnsName: "", visibility: "public" });

  const load = async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const [v, l, d] = await Promise.all([
        NetApi.listVPCs(projectId), NetApi.listLBs(projectId), NetApi.listDNS(projectId),
      ]);
      setVpcs(v as any[]); setLbs(l as any[]); setDnsZones(d as any[]);
    } catch (e: any) { addToast(formatApiError(e), "error"); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [projectId]);

  const createVPC = async () => {
    if (!projectId || !vpcForm.name) return;
    try {
      const v = await NetApi.createVPC(projectId, vpcForm);
      setVpcs(p => [v, ...p]); setShowCreate(null);
      setVpcForm({ name: "", subnet: "10.0.0.0/20", region: "us-central1", mode: "AUTO" });
      addToast(`VPC ${vpcForm.name} created`, "success");
    } catch (e: any) { addToast(formatApiError(e), "error"); }
  };

  const createLB = async () => {
    if (!projectId || !lbForm.name) return;
    try {
      const l = await NetApi.createLB(projectId, lbForm);
      setLbs(p => [l, ...p]); setShowCreate(null);
      setLbForm({ name: "", type: "HTTP", region: "global", backends: 1 });
      addToast(`Load balancer ${lbForm.name} created`, "success");
    } catch (e: any) { addToast(formatApiError(e), "error"); }
  };

  const createDNS = async () => {
    if (!projectId || !dnsForm.name || !dnsForm.dnsName) return;
    try {
      const d = await NetApi.createDNS(projectId, dnsForm);
      setDnsZones(p => [d, ...p]); setShowCreate(null);
      setDnsForm({ name: "", dnsName: "", visibility: "public" });
      addToast(`DNS zone ${dnsForm.dnsName} created`, "success");
    } catch (e: any) { addToast(formatApiError(e), "error"); }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-medium">Networking</h1>
          <p className="text-sm text-gcp-muted mt-0.5">VPC networks, load balancers, and DNS</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowCreate("vpc")} className="btn text-xs flex items-center gap-1"><Plus className="w-3 h-3" /> VPC</button>
          <button onClick={() => setShowCreate("lb")} className="btn text-xs flex items-center gap-1"><Plus className="w-3 h-3" /> Load Balancer</button>
          <button onClick={() => setShowCreate("dns")} className="btn text-xs flex items-center gap-1"><Plus className="w-3 h-3" /> DNS Zone</button>
        </div>
      </div>

      {showCreate === "vpc" && (
        <div className="card p-4 mb-4 border-blue-200 bg-blue-50">
          <h3 className="font-medium mb-3">New VPC Network</h3>
          <div className="grid grid-cols-4 gap-3 mb-3">
            <div><label className="text-xs text-gcp-muted block mb-1">Name *</label>
              <input className="input w-full" value={vpcForm.name} onChange={e => setVpcForm(f => ({ ...f, name: e.target.value }))} placeholder="my-vpc" /></div>
            <p className="text-xs text-gcp-muted mt-0.5">Lowercase letters, digits, hyphens (e.g. my-vpc)</p>
            <div><label className="text-xs text-gcp-muted block mb-1">Subnet CIDR</label>
              <input className="input w-full" value={vpcForm.subnet} onChange={e => setVpcForm(f => ({ ...f, subnet: e.target.value }))} /></div>
            <div><label className="text-xs text-gcp-muted block mb-1">Region</label>
              <select className="input w-full" value={vpcForm.region} onChange={e => setVpcForm(f => ({ ...f, region: e.target.value }))}>
                {REGIONS.map(r => <option key={r}>{r}</option>)}</select></div>
            <div><label className="text-xs text-gcp-muted block mb-1">Subnet Mode</label>
              <select className="input w-full" value={vpcForm.mode} onChange={e => setVpcForm(f => ({ ...f, mode: e.target.value }))}>
                <option>AUTO</option><option>CUSTOM</option></select></div>
          </div>
          <div className="flex gap-2">
            <button onClick={createVPC} className="btn-primary">Create</button>
            <button onClick={() => setShowCreate(null)} className="btn">Cancel</button>
          </div>
        </div>
      )}

      {showCreate === "lb" && (
        <div className="card p-4 mb-4 border-blue-200 bg-blue-50">
          <h3 className="font-medium mb-3">New Load Balancer</h3>
          <div className="grid grid-cols-4 gap-3 mb-3">
            <div><label className="text-xs text-gcp-muted block mb-1">Name *</label>
              <input className="input w-full" value={lbForm.name} onChange={e => setLbForm(f => ({ ...f, name: e.target.value }))} placeholder="my-lb" /></div>
            <p className="text-xs text-gcp-muted mt-0.5">Lowercase letters, digits, hyphens (e.g. my-lb)</p>
            <div><label className="text-xs text-gcp-muted block mb-1">Type</label>
              <select className="input w-full" value={lbForm.type} onChange={e => setLbForm(f => ({ ...f, type: e.target.value }))}>
                <option>HTTP</option><option>HTTPS</option><option>TCP</option><option>UDP</option></select></div>
            <div><label className="text-xs text-gcp-muted block mb-1">Scope</label>
              <select className="input w-full" value={lbForm.region} onChange={e => setLbForm(f => ({ ...f, region: e.target.value }))}>
                <option>global</option>{REGIONS.filter(r=>r!=="global").map(r=><option key={r}>{r}</option>)}</select></div>
            <div><label className="text-xs text-gcp-muted block mb-1">Backends</label>
              <input className="input w-full" type="number" min={1} value={lbForm.backends} onChange={e => setLbForm(f => ({ ...f, backends: +e.target.value }))} /></div>
          </div>
          <div className="flex gap-2">
            <button onClick={createLB} className="btn-primary">Create</button>
            <button onClick={() => setShowCreate(null)} className="btn">Cancel</button>
          </div>
        </div>
      )}

      {showCreate === "dns" && (
        <div className="card p-4 mb-4 border-blue-200 bg-blue-50">
          <h3 className="font-medium mb-3">New DNS Zone</h3>
          <div className="grid grid-cols-3 gap-3 mb-3">
            <div><label className="text-xs text-gcp-muted block mb-1">Zone Name *</label>
              <input className="input w-full" value={dnsForm.name} onChange={e => setDnsForm(f => ({ ...f, name: e.target.value }))} placeholder="my-zone" /></div>
            <p className="text-xs text-gcp-muted mt-0.5">Lowercase letters, digits, hyphens (e.g. my-zone)</p>
            <div><label className="text-xs text-gcp-muted block mb-1">DNS Name *</label>
              <input className="input w-full" value={dnsForm.dnsName} onChange={e => setDnsForm(f => ({ ...f, dnsName: e.target.value }))} placeholder="example.com." /></div>
            <div><label className="text-xs text-gcp-muted block mb-1">Visibility</label>
              <select className="input w-full" value={dnsForm.visibility} onChange={e => setDnsForm(f => ({ ...f, visibility: e.target.value }))}>
                <option>public</option><option>private</option></select></div>
          </div>
          <div className="flex gap-2">
            <button onClick={createDNS} className="btn-primary">Create</button>
            <button onClick={() => setShowCreate(null)} className="btn">Cancel</button>
          </div>
        </div>
      )}

      <Section title="VPC Networks" icon={Network}>
        {vpcs.length === 0 ? <p className="text-sm text-gcp-muted">No VPC networks</p> :
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b"><tr>{["Name","Subnet","Region","Mode",""].map(h => <th key={h} className="px-4 py-2 text-left text-xs font-medium text-gcp-muted">{h}</th>)}</tr></thead>
              <tbody className="divide-y">
                {vpcs.map(v => (
                  <tr key={v.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2.5 font-medium">{v.name}</td>
                    <td className="px-4 py-2.5 text-gcp-muted font-mono text-xs">{v.subnet}</td>
                    <td className="px-4 py-2.5 text-gcp-muted">{v.region}</td>
                    <td className="px-4 py-2.5"><span className="badge">{v.mode}</span></td>
                    <td className="px-4 py-2.5">
                      <button onClick={async () => { await NetApi.deleteVPC(projectId!, v.id); setVpcs(p => p.filter(x => x.id !== v.id)); addToast("VPC deleted", "success"); }} className="btn-icon text-gcp-red hover:bg-red-50"><Trash2 className="w-4 h-4" /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>}
      </Section>

      <Section title="Load Balancers" icon={Globe}>
        {lbs.length === 0 ? <p className="text-sm text-gcp-muted">No load balancers</p> :
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b"><tr>{["Name","Type","Scope","IP","Backends","Status","Cost/hr",""].map(h => <th key={h} className="px-4 py-2 text-left text-xs font-medium text-gcp-muted">{h}</th>)}</tr></thead>
              <tbody className="divide-y">
                {lbs.map(l => (
                  <tr key={l.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2.5 font-medium">{l.name}</td>
                    <td className="px-4 py-2.5"><span className="badge">{l.type}</span></td>
                    <td className="px-4 py-2.5 text-gcp-muted">{l.region}</td>
                    <td className="px-4 py-2.5 font-mono text-xs text-gcp-muted">{l.ip}</td>
                    <td className="px-4 py-2.5 text-gcp-muted">{l.backends}</td>
                    <td className="px-4 py-2.5"><span className="badge bg-green-100 text-green-700">{l.status}</span></td>
                    <td className="px-4 py-2.5 text-gcp-muted">${l.hourlyCost.toFixed(3)}</td>
                    <td className="px-4 py-2.5">
                      <button onClick={async () => { await NetApi.deleteLB(projectId!, l.id); setLbs(p => p.filter(x => x.id !== l.id)); addToast("Load balancer deleted", "success"); }} className="btn-icon text-gcp-red hover:bg-red-50"><Trash2 className="w-4 h-4" /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>}
      </Section>

      <Section title="Cloud DNS" icon={Globe}>
        {dnsZones.length === 0 ? <p className="text-sm text-gcp-muted">No DNS zones</p> :
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b"><tr>{["Zone Name","DNS Name","Visibility","Records",""].map(h => <th key={h} className="px-4 py-2 text-left text-xs font-medium text-gcp-muted">{h}</th>)}</tr></thead>
              <tbody className="divide-y">
                {dnsZones.map(d => (
                  <tr key={d.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2.5 font-medium">{d.name}</td>
                    <td className="px-4 py-2.5 text-gcp-muted">{d.dnsName}</td>
                    <td className="px-4 py-2.5"><span className="badge">{d.visibility}</span></td>
                    <td className="px-4 py-2.5 text-gcp-muted">{d.recordCount}</td>
                    <td className="px-4 py-2.5">
                      <button onClick={async () => { await NetApi.deleteDNS(projectId!, d.id); setDnsZones(p => p.filter(x => x.id !== d.id)); addToast("DNS zone deleted", "success"); }} className="btn-icon text-gcp-red hover:bg-red-50"><Trash2 className="w-4 h-4" /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>}
      </Section>
    </div>
  );
}
