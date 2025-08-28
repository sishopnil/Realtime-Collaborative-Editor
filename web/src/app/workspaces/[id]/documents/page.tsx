'use client';
import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { useSession } from 'next-auth/react';

type Doc = { _id: string; title: string; status: string; tags?: string[] };

export default function WorkspaceDocumentsPage() {
  const { id } = useParams<{ id: string }>();
  const { data } = useSession();
  const token = (data as any)?.accessToken as string | undefined;
  const base = process.env.NEXT_PUBLIC_API_URL || '';

  const [items, setItems] = useState<Doc[]>([]);
  const [title, setTitle] = useState('');
  const [q, setQ] = useState('');
  const [tag, setTag] = useState('');
  const [error, setError] = useState<string | null>(null);

  const headers = useMemo(
    () => ({ Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }),
    [token],
  );

  async function load() {
    const qs = new URLSearchParams({ workspaceId: id as string } as any);
    if (q) qs.set('q', q);
    if (tag) qs.set('tag', tag);
    const res = await fetch(`${base}/api/docs?${qs.toString()}`, {
      headers,
      credentials: 'include',
    });
    const j = await res.json();
    setItems(Array.isArray(j) ? j : []);
  }

  useEffect(() => {
    if (token) void load();
  }, [token, q, tag]);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const res = await fetch(`${base}/api/docs`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ workspaceId: id, title }),
      credentials: 'include',
    });
    if (!res.ok) setError('Failed to create');
    else {
      setTitle('');
      await load();
    }
  };

  const update = async (docId: string, patch: any) => {
    await fetch(`${base}/api/docs/${docId}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(patch),
      credentials: 'include',
    });
    await load();
  };
  const remove = async (docId: string) => {
    await fetch(`${base}/api/docs/${docId}`, { method: 'DELETE', headers, credentials: 'include' });
    await load();
  };

  return (
    <main style={{ padding: 24 }}>
      <h1>Documents</h1>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
        <input placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} />
        <input placeholder="Filter by tag" value={tag} onChange={(e) => setTag(e.target.value)} />
      </div>
      <ul>
        {items.map((d) => (
          <li key={d._id}>
            <strong>{d.title}</strong> [{d.status}] — tags: {(d.tags || []).join(', ') || '—'} —{' '}
            <a href={`/workspaces/${id}/documents/${d._id}/permissions`}>Permissions</a> —
            <a href={`/workspaces/${id}/documents/${d._id}/edit`}>Edit</a> —
            <button
              onClick={() =>
                update(d._id, { status: d.status === 'archived' ? 'active' : 'archived' })
              }
            >
              {d.status === 'archived' ? 'Unarchive' : 'Archive'}
            </button>{' '}
            <button onClick={() => remove(d._id)}>Delete</button>
          </li>
        ))}
      </ul>
      <h2 style={{ marginTop: 16 }}>Create Document</h2>
      <form onSubmit={create} style={{ display: 'grid', gap: 8, maxWidth: 360 }}>
        <input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
        <button type="submit">Create</button>
        {error && <p style={{ color: 'red' }}>{error}</p>}
      </form>
    </main>
  );
}
