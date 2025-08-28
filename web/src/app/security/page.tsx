"use client";
import useSWR from 'swr';
import { apiGet } from '../../lib/api';

export default function SecurityPage() {
  const { data: audit } = useSWR('/api/security/audit?limit=100', apiGet<any>);
  const { data: alerts } = useSWR('/api/security/alerts?limit=50', apiGet<any>);
  return (
    <div style={{ padding: 24 }}>
      <h1>Security Dashboard (Admin)</h1>
      <section>
        <h2>Alerts</h2>
        <pre style={{ whiteSpace: 'pre-wrap' }}>{JSON.stringify(alerts, null, 2)}</pre>
      </section>
      <section>
        <h2>Recent Audit</h2>
        <pre style={{ whiteSpace: 'pre-wrap' }}>{JSON.stringify(audit, null, 2)}</pre>
      </section>
    </div>
  );
}

