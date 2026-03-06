// apps/web/src/hooks/useLiveBillingClock.ts
// Ticks totalSpendUSD every second, creating a live "running cost" counter.
// Uses a ref so the interval closure is always reading the latest hourly rate
// without needing to be recreated when the rate changes.
//
// Usage: call once in your root layout or app shell component:
//   useLiveBillingClock();

import { useEffect, useRef } from "react";
import { useStore, useHourlyRate } from "../store";

const TICK_MS = 1_000; // 1 second

export function useLiveBillingClock(): void {
  const hourlyRate  = useHourlyRate();
  const tickBilling = useStore(s => s.tickBilling);

  // Keep a ref so the setInterval closure never reads stale rate
  const rateRef = useRef(hourlyRate);
  useEffect(() => { rateRef.current = hourlyRate; }, [hourlyRate]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (rateRef.current > 0) {
        tickBilling(rateRef.current / 3_600); // one second's worth of hourly rate
      }
    }, TICK_MS);

    return () => clearInterval(interval);
  }, []); // intentionally empty — rateRef handles currency
}
