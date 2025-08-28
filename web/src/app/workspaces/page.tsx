'use client';
import React, { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import WorkspaceSwitcher from '../../components/WorkspaceSwitcher';

type WS = { _id: string; name: string; slug: string };

export default function WorkspacesPage() {
  const { data } = useSession();
  const [items, setItems] = useState<WS[]>([]);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const base = process.env.NEXT_PUBLIC_API_URL || '';
    const res = await fetch(`${base}/api/workspaces`, {
      headers: { Authorization: `Bearer ${(data as any)?.accessToken}` },
      credentials: 'include',
    });
    const j = await res.json();
    setItems(Array.isArray(j) ? j : []);
  }

  useEffect(() => {
    if (data) void load();
  }, [data]);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const base = process.env.NEXT_PUBLIC_API_URL || '';
    const res = await fetch(`${base}/api/workspaces`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${(data as any)?.accessToken}`,
      },
      body: JSON.stringify({ name, slug }),
      credentials: 'include',
    });
    if (!res.ok) {
      setError('Failed to create workspace');
    } else {
      setName('');
      setSlug('');
      await load();
    }
  };

  return (
    <main style={{ padding: 24 }}>
      <h1>Workspaces</h1>
      <WorkspaceSwitcher />
      <h2 style={{ marginTop: 16 }}>Your Workspaces</h2>
      <ul>
        {items.map((w) => (
          <li key={w._id}>
            {w.name} ({w.slug}) — <a href={`/workspaces/${w._id}/documents`}>Documents</a> —{' '}
            <a href={`/workspaces/${w._id}/members`}>Members</a> —{' '}
            <a href={`/workspaces/${w._id}/settings`}>Settings</a>
          </li>
        ))}
      </ul>
      <h2 style={{ marginTop: 16 }}>Create Workspace</h2>
      <form onSubmit={create} style={{ display: 'grid', gap: 8, maxWidth: 320 }}>
        <input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
        <input
          placeholder="Slug (url-safe)"
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
        />
        <button type="submit">Create</button>
        {error && <p style={{ color: 'red' }}>{error}</p>}
      </form>
    </main>
  );
}
