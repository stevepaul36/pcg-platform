"use client";

import { useRef, useEffect } from "react";
import { useStore } from "../store";
import { Terminal, Sparkles, Scroll, Trash2, Loader2 } from "lucide-react";

export function RightPanel() {
  const panel     = useStore((s) => s.rightPanel);
  const setPanel  = useStore((s) => s.setRightPanel);

  return (
    <aside className="w-80 bg-white border-l border-gcp-border flex flex-col shrink-0 hidden lg:flex">
      {/* Tab bar */}
      <div className="flex border-b border-gcp-border shrink-0">
        <TabBtn active={panel === "console"} onClick={() => setPanel("console")} icon={<Terminal className="w-3.5 h-3.5" />} label="Console" />
        <TabBtn active={panel === "ai"}      onClick={() => setPanel("ai")}      icon={<Sparkles className="w-3.5 h-3.5" />} label="Insights" />
        <TabBtn active={panel === "log"}     onClick={() => setPanel("log")}     icon={<Scroll className="w-3.5 h-3.5" />}    label="Events" />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {panel === "console" && <ConsolePanel />}
        {panel === "ai"      && <AIPanel />}
        {panel === "log"     && <EventPanel />}
      </div>
    </aside>
  );
}

function TabBtn({ active, onClick, icon, label }: {
  active: boolean; onClick: () => void; icon: React.ReactNode; label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-colors border-b-2 ${
        active ? "border-gcp-blue text-gcp-blue" : "border-transparent text-gcp-muted hover:text-gcp-text"
      }`}
    >
      {icon}{label}
    </button>
  );
}

function ConsolePanel() {
  const logs        = useStore((s) => s.consoleLogs);
  const loading     = useStore((s) => s.consoleLoading);
  const clearLogs   = useStore((s) => s.clearConsole);
  const endRef      = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs.length]);

  const levelColor = (level: string) => {
    switch (level) {
      case "ERROR":   return "text-gcp-red";
      case "WARNING": return "text-yellow-600";
      case "SUCCESS": return "text-gcp-green";
      default:        return "text-gcp-blue";
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-2 border-b border-gcp-border bg-gray-50">
        <span className="text-xs text-gcp-muted">{logs.length} entries</span>
        <button onClick={clearLogs} className="btn-icon" title="Clear console">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto font-mono text-[11px] leading-relaxed p-3 bg-gray-900 text-gray-300">
        {logs.length === 0 && !loading && (
          <p className="text-gray-500 text-center mt-8">Console output appears here</p>
        )}
        {logs.map((log) => (
          <div key={log.id} className="flex gap-2 py-0.5">
            <span className="text-gray-600 shrink-0">
              {new Date(log.ts).toLocaleTimeString("en-US", { hour12: false })}
            </span>
            <span className={`shrink-0 w-16 ${levelColor(log.level)}`}>[{log.level}]</span>
            <span className="break-all">{log.text}</span>
          </div>
        ))}
        {loading && (
          <div className="flex items-center gap-2 py-1 text-gcp-blue">
            <Loader2 className="w-3 h-3 animate-spin" />
            <span>Processing...</span>
          </div>
        )}
        <div ref={endRef} />
      </div>
    </div>
  );
}

function AIPanel() {
  const insight = useStore((s) => s.aiInsight);
  const email   = useStore((s) => s.aiEmail);
  const loading = useStore((s) => s.aiLoading);

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2 border-b border-gcp-border bg-gray-50">
        <span className="text-xs text-gcp-muted">AI-generated insights about your resources</span>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-gcp-muted">
            <Loader2 className="w-6 h-6 animate-spin text-gcp-blue" />
            <p className="text-xs">Analyzing your resources...</p>
          </div>
        ) : insight ? (
          <div className="space-y-3">
            <div className="text-sm text-gcp-text whitespace-pre-line leading-relaxed">{insight}</div>
            {email && (
              <div className="mt-4 p-3 bg-gray-50 rounded-lg border border-gcp-border">
                <p className="text-xs font-medium text-gcp-muted mb-2">Suggested Report Email</p>
                <div className="text-xs text-gcp-text whitespace-pre-line font-mono">{email}</div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center text-gcp-muted">
            <Sparkles className="w-8 h-8 mb-3 text-gray-300" />
            <p className="text-sm">No insights yet</p>
            <p className="text-xs mt-1">Insights appear here as you use the platform</p>
          </div>
        )}
      </div>
    </div>
  );
}

function EventPanel() {
  const logs = useStore((s) => s.activityLogs);

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2 border-b border-gcp-border bg-gray-50">
        <span className="text-xs text-gcp-muted">{logs.length} recent events</span>
      </div>
      <div className="flex-1 overflow-y-auto">
        {logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gcp-muted">
            <Scroll className="w-8 h-8 mb-3 text-gray-300" />
            <p className="text-xs">No events yet</p>
          </div>
        ) : (
          <div className="divide-y divide-gcp-border">
            {logs.slice(0, 30).map((log) => (
              <div key={log.id} className="px-3 py-2.5">
                <div className="flex items-center gap-1.5">
                  <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                    log.severity === "ERROR" ? "bg-gcp-red" :
                    log.severity === "WARNING" ? "bg-gcp-yellow" : "bg-gcp-green"
                  }`} />
                  <p className="text-xs font-medium truncate">{log.description}</p>
                </div>
                <p className="text-[10px] text-gcp-muted mt-0.5 ml-3">
                  {new Date(log.timestamp).toLocaleTimeString()} · {log.type}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
