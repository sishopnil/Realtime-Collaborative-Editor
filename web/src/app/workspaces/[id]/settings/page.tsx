'use client';
import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useSession } from 'next-auth/react';

export default function WorkspaceSettingsPage() {
  const { id } = useParams<{ id: string }>();
  const { data } = useSession();
  const [maxDocuments, setMaxDocuments] = useState<number | ''>('');
  const [message, setMessage] = useState<string | null>(null);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    const base = process.env.NEXT_PUBLIC_API_URL || '';
    const res = await fetch(`${base}/api/workspaces/${id}/settings`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${(data as any)?.accessToken}`,
      },
      body: JSON.stringify({
        settings: { resourceLimits: { maxDocuments: maxDocuments || null } },
      }),
      credentials: 'include',
    });
    setMessage(res.ok ? 'Saved' : 'Failed to save');
  };

  return (
    <main style={{ padding: 24 }}>
      <h1>Workspace Settings</h1>
      <form onSubmit={save} style={{ display: 'grid', gap: 8, maxWidth: 320 }}>
        <label>
          Max Documents:{' '}
          <input
            type="number"
            value={maxDocuments as any}
            onChange={(e) => setMaxDocuments(e.target.value ? parseInt(e.target.value) : '')}
          />
        </label>
        <button type="submit">Save</button>
      </form>
      {message && <p>{message}</p>}
    </main>
  );
}
