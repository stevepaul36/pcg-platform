// apps/web/src/hooks/useSessionTimer.ts
// Provides session duration and VM uptime counters for the dashboard status bar.
//
// Usage:
//   const { formattedSession, formattedVMRuntime, hasRunningVMs } = useSessionTimer();
//   // → "00:32:15"  "00:18:03"  true

import { useState, useEffect } from "react";
import { useStore }             from "../store";

/** Formats an integer number of seconds as "HH:MM:SS" */
export function formatDuration(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3_600);
  const m = Math.floor((totalSeconds % 3_600) / 60);
  const s = totalSeconds % 60;
  return [h, m, s].map(n => String(n).padStart(2, "0")).join(":");
}

export function useSessionTimer() {
  const [sessionStart]  = useState(() => Date.now());
  const [sessionSec, setSessionSec] = useState(0);
  const vms = useStore(s => s.vms);

  useEffect(() => {
    const id = setInterval(() => {
      setSessionSec(Math.floor((Date.now() - sessionStart) / 1_000));
    }, 1_000);
    return () => clearInterval(id);
  }, [sessionStart]);

  const runningVMs = vms.filter(v => v.status === "RUNNING");
  const longestUptimeSec = runningVMs.length > 0
    ? Math.max(...runningVMs.map(v => v.uptimeSec))
    : 0;

  return {
    sessionSec,
    vmUptimeSec:        longestUptimeSec,
    formattedSession:   formatDuration(sessionSec),
    formattedVMRuntime: formatDuration(longestUptimeSec),
    hasRunningVMs:      runningVMs.length > 0,
    runningCount:       runningVMs.length,
  };
}
