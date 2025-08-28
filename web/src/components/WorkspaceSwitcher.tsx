'use client';
import React, { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';

type WS = { _id: string; name: string; slug: string };

export default function WorkspaceSwitcher() {
  const { data } = useSession();
  const [items, setItems] = useState<WS[]>([]);
  const [current, setCurrent] = useState<string | null>(null);

  useEffect(() => {
    setCurrent(localStorage.getItem('currentWorkspace'));
  }, []);

  useEffect(() => {
    async function load() {
      const base = process.env.NEXT_PUBLIC_API_URL || '';
      const res = await fetch(`${base}/api/workspaces`, {
        headers: { Authorization: `Bearer ${(data as any)?.accessToken}` },
        credentials: 'include',
      });
      const j = await res.json();
      setItems(j || []);
    }
    if (data) void load();
  }, [data]);

  const select = (id: string) => {
    localStorage.setItem('currentWorkspace', id);
    setCurrent(id);
  };

  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
      <span>Workspace:</span>
      <select value={current || ''} onChange={(e) => select(e.target.value)}>
        <option value="">Select...</option>
        {items.map((w) => (
          <option key={w._id} value={w._id}>
            {w.name}
          </option>
        ))}
      </select>
    </div>
  );
}
