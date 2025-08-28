'use client';
import React, { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';

export default function SessionsPage() {
  const { data } = useSession();
  const [sessions, setSessions] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      const base = process.env.NEXT_PUBLIC_API_URL || '';
      const res = await fetch(`${base}/api/auth/sessions`, {
        headers: { Authorization: `Bearer ${(data as any)?.accessToken}` },
        credentials: 'include',
      });
      const j = await res.json();
      setSessions(j.sessions || []);
    } catch (e: any) {
      setError(e.message);
    }
  }

  useEffect(() => {
    if (data) void load();
  }, [data]);

  const revoke = async (jti: string) => {
    const base = process.env.NEXT_PUBLIC_API_URL || '';
    await fetch(`${base}/api/auth/sessions/revoke`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${(data as any)?.accessToken}`,
      },
      body: JSON.stringify({ refreshId: jti }),
      credentials: 'include',
    });
    await load();
  };

  return (
    <main style={{ padding: 24 }}>
      <h1>Active Sessions</h1>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      <ul>
        {sessions.map((s) => (
          <li key={s.jti} style={{ margin: '8px 0' }}>
            <code>{s.jti}</code> — {s.ua || 'unknown device'} — {s.ip || 'unknown ip'} —{' '}
            <button onClick={() => revoke(s.jti)}>Revoke</button>
          </li>
        ))}
      </ul>
    </main>
  );
}
