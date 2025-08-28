"use client";
import { useState } from 'react';
import { apiPost } from '../../lib/api';

export default function PrivacyPage() {
  const [exportData, setExportData] = useState<any>(null);
  const [status, setStatus] = useState<string>('');

  async function handleExport() {
    setStatus('Exporting...');
    try {
      const data = await apiPost<any>('/api/privacy/export');
      setExportData(data);
      setStatus('Export complete');
    } catch (e: any) {
      setStatus(e.message || 'Export failed');
    }
  }

  async function handleDelete() {
    if (!confirm('This will anonymize your data and revoke sessions. Continue?')) return;
    setStatus('Processing deletion...');
    try {
      await apiPost<any>('/api/privacy/delete');
      setStatus('Deletion/anonymization complete');
    } catch (e: any) {
      setStatus(e.message || 'Deletion failed');
    }
  }

  return (
    <div style={{ padding: 24 }}>
      <h1>Privacy Controls</h1>
      <p>Export or request deletion/anonymization of your data.</p>
      <div style={{ display: 'flex', gap: 12 }}>
        <button onClick={handleExport}>Export My Data</button>
        <button onClick={handleDelete}>Delete/Anonymize My Data</button>
      </div>
      <p>{status}</p>
      {exportData && (
        <pre style={{ whiteSpace: 'pre-wrap', marginTop: 16 }}>{JSON.stringify(exportData, null, 2)}</pre>
      )}
    </div>
  );
}

