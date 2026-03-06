"use client";

import { useStore } from "../store";
import { ScrollText, ChevronDown, Loader2, AlertTriangle, Info, AlertCircle } from "lucide-react";

export function ActivityLog() {
  const logs = useStore((s) => s.activityLogs);
  const loading = useStore((s) => s.loading.logs);
  const pagination = useStore((s) => s.pagination.logs);
  const loadLogs = useStore((s) => s.loadLogs);

  const loadMore = () => {
    if (pagination.nextCursor) loadLogs(pagination.nextCursor);
  };

  const severityIcon = (severity: string) => {
    switch (severity) {
      case "ERROR":   return <AlertCircle className="w-4 h-4 text-gcp-red" />;
      case "WARNING": return <AlertTriangle className="w-4 h-4 text-yellow-600" />;
      default:        return <Info className="w-4 h-4 text-gcp-blue" />;
    }
  };

  return (
    <div className="space-y-4 max-w-4xl">
      <div>
        <h1 className="text-xl font-semibold">Activity Log</h1>
        <p className="text-sm text-gcp-muted mt-1">Audit trail of all project actions</p>
      </div>

      <div className="card">
        {loading && logs.length === 0 ? (
          <div className="p-12 text-center">
            <Loader2 className="w-6 h-6 animate-spin mx-auto text-gcp-blue" />
          </div>
        ) : logs.length === 0 ? (
          <div className="p-12 text-center">
            <ScrollText className="w-10 h-10 text-gcp-muted mx-auto mb-3" />
            <p className="text-sm text-gcp-muted">No activity logged yet. Actions will appear here as you use the platform.</p>
          </div>
        ) : (
          <>
            <div className="divide-y divide-gcp-border">
              {logs.map((log) => (
                <div key={log.id} className="px-6 py-4 flex items-start gap-3 hover:bg-gray-50 transition-colors">
                  <div className="mt-0.5 shrink-0">{severityIcon(log.severity)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4">
                      <p className="text-sm font-medium">{log.description}</p>
                      <span className={`badge shrink-0 ${
                        log.severity === "ERROR" ? "bg-red-50 text-gcp-red" :
                        log.severity === "WARNING" ? "bg-yellow-50 text-yellow-700" :
                        "bg-blue-50 text-gcp-blue"
                      }`}>{log.type}</span>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-gcp-muted">
                      <span>{log.user}</span>
                      <span>·</span>
                      <span>{new Date(log.timestamp).toLocaleString()}</span>
                      {log.resourceId && (
                        <>
                          <span>·</span>
                          <span className="font-mono text-[11px]">{log.resourceId.slice(0, 12)}...</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {pagination.hasNextPage && (
              <div className="p-4 border-t border-gcp-border text-center">
                <button onClick={loadMore} disabled={loading} className="btn-secondary text-sm flex items-center gap-1 mx-auto">
                  {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  Load more
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
