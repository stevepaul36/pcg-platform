// apps/web/src/hooks/useMetricsPolling.ts
// Polls /api/v1/vms every 10 s for live metrics.
// Every 60 s, syncs the authoritative totalSpendUSD from the DB
// to prevent long-session drift between optimistic client ticks and reality.
//
// IMPORTANT: This hook does NOT tick billing. That is the sole responsibility
// of useLiveBillingClock. The previous version ticked billing here too, which
// caused double-counting of spend.

import { useEffect, useRef } from "react";
import { useStore }          from "../store";
import { VMs, Auth }         from "../lib/apiClient";

const POLL_INTERVAL_MS = 10_000; // 10 seconds
const DB_SYNC_EVERY    = 6;      // every 6th tick = once per minute

export function useMetricsPolling(): void {
  const projectId       = useStore(s => s.projectId);
  const patchVM         = useStore(s => s.patchVM);
  const syncSpendFromDB = useStore(s => s.syncSpendFromDB);

  const tickCountRef = useRef(0);

  useEffect(() => {
    if (!projectId) return;

    const interval = setInterval(async () => {
      try {
        const updatedVMs = await VMs.list(projectId);

        // Sync each VM with server-authoritative data
        updatedVMs.forEach(vm => patchVM(vm.id, vm));

        // Once per minute: replace optimistic client value with DB truth
        tickCountRef.current++;
        if (tickCountRef.current % DB_SYNC_EVERY === 0) {
          try {
            const me = await Auth.me();
            const project = me.projects.find((p: any) => p.id === projectId);
            if (project?.totalSpendUSD != null) {
              syncSpendFromDB(project.totalSpendUSD);
            }
          } catch {
            // DB sync failure is non-critical; client value is still close
          }
        }
      } catch {
        // Polling failures are silent — UI shows last-known-good data
      }
    }, POLL_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [projectId, patchVM, syncSpendFromDB]);
}
