"use client";
import { useState } from 'react';
import Editor, { EditorValue } from '../../components/Editor';
import { EditorErrorBoundary } from '../../components/EditorErrorBoundary';

export default function EditorDemoPage() {
  const [value, setValue] = useState<EditorValue>({ type: 'html', content: '<p>Hello <strong>TipTap</strong>!</p>' });

  return (
    <div style={{ padding: 24, maxWidth: 820, margin: '0 auto' }}>
      <h1>Editor Demo</h1>
      <p>Basic TipTap editor with toolbar, keyboard shortcuts, and accessibility features.</p>
      <EditorErrorBoundary>
        <Editor value={value} onChange={setValue} placeholder="Start typing..." />
      </EditorErrorBoundary>
      <section style={{ marginTop: 20 }}>
        <h3>Serialized JSON</h3>
        <pre style={{ whiteSpace: 'pre-wrap' }}>{JSON.stringify(value, null, 2)}</pre>
      </section>
    </div>
  );
}

