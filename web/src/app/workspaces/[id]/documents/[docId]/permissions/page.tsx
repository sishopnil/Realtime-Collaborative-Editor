'use client';
import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { useSession } from 'next-auth/react';

export default function DocPermissionsPage() {
  const { id, docId } = useParams<{ id: string; docId: string }>();
  const { data } = useSession();
  const token = (data as any)?.accessToken as string | undefined;
  const headers = useMemo(
    () => ({ Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }),
    [token],
  );
  const base = process.env.NEXT_PUBLIC_API_URL || '';

  const [items, setItems] = useState<any[]>([]);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'viewer' | 'editor'>('viewer');

  async function load() {
    const res = await fetch(`${base}/api/docs/${docId}/permissions`, {
      headers,
      credentials: 'include',
    });
    const j = await res.json();
    setItems(Array.isArray(j) ? j : []);
  }

  useEffect(() => {
    if (token) void load();
  }, [token]);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetch(`${base}/api/docs/${docId}/permissions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ email, role }),
      credentials: 'include',
    });
    setEmail('');
    await load();
  };

  const remove = async (userId: string) => {
    await fetch(`${base}/api/docs/${docId}/permissions/${userId}`, {
      method: 'DELETE',
      headers,
      credentials: 'include',
    });
    await load();
  };

  return (
    <main style={{ padding: 24 }}>
      <h1>Document Permissions</h1>
      <ul>
        {items.map((p) => (
          <li key={p._id}>
            userId: {p.userId} — role: {p.role}{' '}
            <button onClick={() => remove(p.userId)}>Remove</button>
          </li>
        ))}
      </ul>
      <h2 style={{ marginTop: 16 }}>Share by Email</h2>
      <form onSubmit={add} style={{ display: 'grid', gap: 8, maxWidth: 360 }}>
        <input
          placeholder="Recipient email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <select value={role} onChange={(e) => setRole(e.target.value as any)}>
          <option value="viewer">Viewer</option>
          <option value="editor">Editor</option>
        </select>
        <button type="submit">Share</button>
      </form>
    </main>
  );
}
