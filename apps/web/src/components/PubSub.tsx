"use client";
import { useState, useEffect } from "react";
import { useStore } from "../store";
import { PubSub as PubSubApi, formatApiError } from "../lib/apiClient";
import { Radio, Plus, Trash2, ChevronRight, ChevronDown } from "lucide-react";

export function PubSubPanel() {
  const projectId = useStore(s => s.projectId);
  const addToast = useStore(s => s.addToast);
  const [topics, setTopics] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [showCreate, setShowCreate] = useState(false);
  const [showSub, setShowSub] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [subForm, setSubForm] = useState({ name: "", ackDeadline: 10 });

  const load = async () => {
    if (!projectId) return;
    setLoading(true);
    try { setTopics((await PubSubApi.list(projectId)) as any[]); }
    catch (e: any) { addToast(formatApiError(e), "error"); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [projectId]);

  const createTopic = async () => {
    if (!projectId || !name) return;
    try {
      const t = await PubSubApi.createTopic(projectId, { name });
      setTopics(p => [{ ...t, subscriptions: [] }, ...p]);
      setShowCreate(false); setName(""); addToast(`Topic ${name} created`, "success");
    } catch (e: any) { addToast(formatApiError(e), "error"); }
  };

  const deleteTopic = async (t: any) => {
    if (!projectId) return;
    try {
      await PubSubApi.deleteTopic(projectId, t.id);
      setTopics(p => p.filter(x => x.id !== t.id)); addToast(`Topic ${t.name} deleted`, "success");
    } catch (e: any) { addToast(formatApiError(e), "error"); }
  };

  const createSub = async (topicId: string) => {
    if (!projectId || !subForm.name) return;
    try {
      const s = await PubSubApi.createSubscription(projectId, topicId, subForm);
      setTopics(p => p.map(t => t.id === topicId ? { ...t, subscriptions: [...(t.subscriptions || []), s] } : t));
      setShowSub(null); setSubForm({ name: "", ackDeadline: 10 }); addToast(`Subscription created`, "success");
    } catch (e: any) { addToast(formatApiError(e), "error"); }
  };

  const deleteSub = async (topicId: string, subId: string, subName: string) => {
    if (!projectId) return;
    try {
      await PubSubApi.deleteSubscription(projectId, subId);
      setTopics(p => p.map(t => t.id === topicId ? { ...t, subscriptions: t.subscriptions.filter((s: any) => s.id !== subId) } : t));
      addToast(`Subscription ${subName} deleted`, "success");
    } catch (e: any) { addToast(formatApiError(e), "error"); }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-medium">Pub/Sub</h1>
          <p className="text-sm text-gcp-muted mt-0.5">Asynchronous messaging and event streaming</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> Create Topic
        </button>
      </div>

      {showCreate && (
        <div className="card p-4 mb-4 border-blue-200 bg-blue-50">
          <h3 className="font-medium mb-3">New Topic</h3>
          <div className="flex gap-3 items-end">
            <div>
              <label className="text-xs text-gcp-muted block mb-1">Topic ID *</label>
              <input className="input" value={name} onChange={e => setName(e.target.value)} placeholder="my-topic" />
                <p className="text-xs text-gcp-muted mt-0.5">Letters, digits, hyphens, dots (e.g. my-topic)</p>
            </div>
            <button onClick={createTopic} className="btn-primary">Create</button>
            <button onClick={() => setShowCreate(false)} className="btn">Cancel</button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="card p-8 text-center text-gcp-muted">Loading...</div>
      ) : topics.length === 0 ? (
        <div className="card p-12 text-center">
          <Radio className="w-10 h-10 text-gcp-muted mx-auto mb-3" />
          <p className="text-gcp-muted">No topics yet. Create one to start messaging.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {topics.map(t => (
            <div key={t.id} className="card">
              <div
                className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50"
                onClick={() => setExpanded(p => { const n = new Set(p); n.has(t.id) ? n.delete(t.id) : n.add(t.id); return n; })}
              >
                <div className="flex items-center gap-3">
                  {expanded.has(t.id) ? <ChevronDown className="w-4 h-4 text-gcp-muted" /> : <ChevronRight className="w-4 h-4 text-gcp-muted" />}
                  <Radio className="w-4 h-4 text-gcp-blue" />
                  <span className="font-medium text-sm">{t.name}</span>
                  <span className="text-xs text-gcp-muted">{t.subscriptions?.length || 0} subscriptions</span>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={e => { e.stopPropagation(); setShowSub(t.id); }} className="btn text-xs flex items-center gap-1">
                    <Plus className="w-3 h-3" /> Subscribe
                  </button>
                  <button onClick={e => { e.stopPropagation(); deleteTopic(t); }} className="btn-icon text-gcp-red hover:bg-red-50">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {showSub === t.id && (
                <div className="px-4 pb-4 border-t bg-gray-50">
                  <div className="pt-3 flex gap-3 items-end">
                    <div>
                      <label className="text-xs text-gcp-muted block mb-1">Subscription ID *</label>
                      <input className="input" value={subForm.name} onChange={e => setSubForm(f => ({ ...f, name: e.target.value }))} placeholder="my-sub" />
                    </div>
                    <div>
                      <label className="text-xs text-gcp-muted block mb-1">Ack deadline (s)</label>
                      <input className="input w-20" type="number" value={subForm.ackDeadline} onChange={e => setSubForm(f => ({ ...f, ackDeadline: +e.target.value }))} />
                    </div>
                    <button onClick={() => createSub(t.id)} className="btn-primary">Create</button>
                    <button onClick={() => setShowSub(null)} className="btn">Cancel</button>
                  </div>
                </div>
              )}

              {expanded.has(t.id) && (
                <div className="border-t">
                  {(t.subscriptions || []).length === 0 ? (
                    <p className="text-sm text-gcp-muted px-12 py-3">No subscriptions</p>
                  ) : t.subscriptions.map((s: any) => (
                    <div key={s.id} className="flex items-center justify-between px-12 py-2 border-b last:border-0 hover:bg-gray-50">
                      <div className="flex items-center gap-2">
                        <span className="text-sm">{s.name}</span>
                        <span className="text-xs text-gcp-muted">ack: {s.ackDeadline}s</span>
                        <span className="text-xs text-gcp-muted">{s.messageCount} msgs</span>
                      </div>
                      <button onClick={() => deleteSub(t.id, s.id, s.name)} className="btn-icon text-gcp-red hover:bg-red-50">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
