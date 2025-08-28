'use client';
import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useSession } from 'next-auth/react';

export default function MembersPage() {
  const { id } = useParams<{ id: string }>();
  const { data } = useSession();
  const [members, setMembers] = useState<any[]>([]);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'viewer' | 'editor' | 'admin'>('viewer');
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const base = process.env.NEXT_PUBLIC_API_URL || '';
    const res = await fetch(`${base}/api/workspaces/${id}/members`, {
      headers: { Authorization: `Bearer ${(data as any)?.accessToken}` },
      credentials: 'include',
    });
    const j = await res.json();
    setMembers(Array.isArray(j) ? j : []);
  }

  useEffect(() => {
    if (data) void load();
  }, [data]);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const base = process.env.NEXT_PUBLIC_API_URL || '';
    const res = await fetch(`${base}/api/workspaces/${id}/members`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${(data as any)?.accessToken}`,
      },
      body: JSON.stringify({ email, role }),
      credentials: 'include',
    });
    if (res.ok) {
      setEmail('');
      await load();
    } else setError('Failed to add member');
  };

  const remove = async (userId: string) => {
    const base = process.env.NEXT_PUBLIC_API_URL || '';
    await fetch(`${base}/api/workspaces/${id}/members/${userId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${(data as any)?.accessToken}` },
      credentials: 'include',
    });
    await load();
  };

  return (
    <main style={{ padding: 24 }}>
      <h1>Members</h1>
      <ul>
        {members.map((m) => (
          <li key={m._id}>
            userId: {m.userId} — role: {m.role}{' '}
            <button onClick={() => remove(m.userId)}>Remove</button>
          </li>
        ))}
      </ul>
      <h2 style={{ marginTop: 16 }}>Invite/Add Member</h2>
      <form onSubmit={add} style={{ display: 'grid', gap: 8, maxWidth: 320 }}>
        <input placeholder="User email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <select value={role} onChange={(e) => setRole(e.target.value as any)}>
          <option value="viewer">Viewer</option>
          <option value="editor">Editor</option>
          <option value="admin">Admin</option>
        </select>
        <button type="submit">Add</button>
        {error && <p style={{ color: 'red' }}>{error}</p>}
      </form>
    </main>
  );
}
