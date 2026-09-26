import { useEffect, useState } from 'react';
import type { DashboardData } from './data/types.ts';

export interface DataState {
  data?: DashboardData;
  /** Local time of the last successful load. */
  loadedAt?: Date;
  /** The last refresh failed; `data` is the previous good copy. */
  offline: boolean;
  error?: string;
}

/**
 * Loads the data file and refreshes it periodically. A failed refresh keeps
 * the last good data on screen and raises `offline`, so the TV never goes
 * blank because of a network hiccup.
 */
export function useDashboardData(url: string, refreshMs: number): DataState {
  const [state, setState] = useState<DataState>({ offline: false });

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch(url, { cache: 'no-store' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as DashboardData;
        if (!cancelled) setState({ data, loadedAt: new Date(), offline: false });
      } catch (e) {
        if (!cancelled) setState((prev) => ({ ...prev, offline: true, error: String(e) }));
      }
    };
    load();
    const timer = window.setInterval(load, refreshMs);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [url, refreshMs]);

  return state;
}
