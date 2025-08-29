"use client";

import { useEffect, useRef, useState } from 'react';

export type ConnectionHealth = {
  status: 'ok' | 'degraded' | 'down';
  rttMs?: number;
  lastChecked?: number;
  details?: { mongo?: boolean; redis?: boolean };
};

export function useConnectionMonitor(apiBase?: string, intervalMs = 15000) {
  const base = apiBase || (process.env.NEXT_PUBLIC_API_URL as string) || '';
  const [health, setHealth] = useState<ConnectionHealth>({ status: 'ok' });
  const timer = useRef<any>();

  useEffect(() => {
    const check = async () => {
      const started = performance.now();
      try {
        const res = await fetch(`${base}/ready`, { credentials: 'include' });
        const rtt = performance.now() - started;
        if (res.ok) {
          const json = await res.json();
          const ok = json?.status === 'ready';
          setHealth({ status: ok ? 'ok' : 'degraded', rttMs: rtt, lastChecked: Date.now(), details: { mongo: !!json.mongo, redis: !!json.redis } });
        } else {
          setHealth({ status: 'down', rttMs: rtt, lastChecked: Date.now() });
        }
      } catch {
        setHealth({ status: 'down', lastChecked: Date.now() });
      }
    };
    check();
    timer.current = setInterval(check, intervalMs);
    return () => clearInterval(timer.current);
  }, [base, intervalMs]);

  return health;
}

