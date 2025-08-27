"use client";
import useSWR from 'swr';
import { apiGet } from '../../lib/api';

export default function DocsPage() {
  const { data, error, isLoading } = useSWR('/health', apiGet<any>);
  return (
    <main style={{ padding: 24 }}>
      <h2>System Health</h2>
      {isLoading && <p>Loading...</p>}
      {error && <p style={{ color: 'crimson' }}>Error: {(error as Error).message}</p>}
      {data && (
        <pre style={{ background: '#f6f8fa', padding: 12 }}>{JSON.stringify(data, null, 2)}</pre>
      )}
    </main>
  );
}

