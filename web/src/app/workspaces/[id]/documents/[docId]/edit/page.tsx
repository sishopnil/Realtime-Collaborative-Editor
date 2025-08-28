"use client";
import { useEffect, useMemo, useRef, useState } from 'react';
import EditorCollab, { EditorCollabHandle } from '../../../../../../components/EditorCollab';
import { useSession } from 'next-auth/react';

export default function DocEditPage({ params }: { params: { id: string; docId: string } }) {
  const { id, docId } = params;
  const { data } = useSession();
  const token = (data as any)?.accessToken as string | undefined;
  const base = process.env.NEXT_PUBLIC_API_URL || '';
  const headers = useMemo(() => ({ Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }), [token]);
  const ref = useRef<EditorCollabHandle>(null);
  const [title, setTitle] = useState('');
  const [tags, setTags] = useState('');
  const [status, setStatus] = useState<string>('');
  const bcRef = useRef<BroadcastChannel | null>(null);
  useEffect(() => {
    try {
      localStorage.setItem(`editorSession:${docId}`, JSON.stringify({ openedAt: Date.now() }));
      const onUnload = () => localStorage.removeItem(`editorSession:${docId}`);
      window.addEventListener('beforeunload', onUnload);
      return () => {
        onUnload();
        window.removeEventListener('beforeunload', onUnload);
      };
    } catch {}
  }, [docId]);

  useEffect(() => {
    if (!token) return;
    (async () => {
      const res = await fetch(`${base}/api/docs?workspaceId=${id}`, { headers, credentials: 'include' });
      const list = await res.json();
      const doc = Array.isArray(list) ? list.find((d: any) => d._id === docId) : null;
      if (doc) {
        setTitle(doc.title || '');
        setTags((doc.tags || []).join(','));
        setStatus(doc.status || 'active');
      }
    })();
  }, [token, id, docId]);

  useEffect(() => {
    bcRef.current = new BroadcastChannel(`doc-meta-${docId}`);
    const bc = bcRef.current;
    bc.onmessage = (ev) => {
      if (ev.data?.type === 'meta') {
        const { title, tags } = ev.data;
        setTitle((t) => (t !== title ? title : t));
        setTags((x) => (x !== tags ? tags : x));
      }
    };
    return () => bc.close();
  }, [docId]);

  // Debounced save metadata
  useEffect(() => {
    if (!token) return;
    const h = setTimeout(() => {
      fetch(`${base}/api/docs/${docId}`, {
        method: 'PATCH',
        headers,
        credentials: 'include',
        body: JSON.stringify({ title, tags: tags.split(',').map((s) => s.trim()).filter(Boolean) }),
      }).catch(() => {});
      bcRef.current?.postMessage({ type: 'meta', title, tags });
    }, 500);
    return () => clearTimeout(h);
  }, [title, tags, token, headers, base, docId]);

  function exportHTML() {
    const html = ref.current?.getHTML() || '';
    download(`doc-${docId}.html`, html);
  }
  function exportMarkdown() {
    const json = ref.current?.getJSON();
    const md = json ? toMarkdown(json) : '';
    download(`doc-${docId}.md`, md);
  }

  return (
    <div style={{ padding: 24, maxWidth: 900, margin: '0 auto' }}>
      <h1>Document Editor</h1>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <input style={{ flex: 1 }} placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
        <input style={{ flex: 1 }} placeholder="tags (comma-separated)" value={tags} onChange={(e) => setTags(e.target.value)} />
        <button onClick={exportHTML}>Export HTML</button>
        <button onClick={exportMarkdown}>Export MD</button>
      </div>
      <EditorCollab ref={ref} docId={docId} />
    </div>
  );
}

function download(name: string, data: string) {
  const blob = new Blob([data], { type: 'text/plain' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}

// Minimal JSON to Markdown converter for common nodes/marks
function toMarkdown(doc: any): string {
  function marks(text: string, m: any[]): string {
    let t = text;
    for (const mk of m || []) {
      if (mk.type === 'bold') t = `**${t}**`;
      if (mk.type === 'italic') t = `*${t}*`;
      if (mk.type === 'underline') t = `__${t}__`;
      if (mk.type === 'link') t = `[${t}](${mk.attrs?.href})`;
    }
    return t;
  }
  function text(node: any): string {
    if (node.type === 'text') return marks(node.text || '', node.marks || []);
    return node.content ? node.content.map(text).join('') : '';
  }
  function render(node: any, depth = 0): string {
    switch (node.type) {
      case 'doc':
        return (node.content || []).map((c: any) => render(c, depth)).join('\n\n');
      case 'paragraph':
        return (node.content || []).map(text).join('');
      case 'heading':
        return `${'#'.repeat(node.attrs?.level || 1)} ${(node.content || []).map(text).join('')}`;
      case 'bulletList':
        return (node.content || [])
          .map((li: any) => `- ${render(li, depth + 1)}`)
          .join('\n');
      case 'orderedList':
        let i = 1;
        return (node.content || [])
          .map((li: any) => `${i++}. ${render(li, depth + 1)}`)
          .join('\n');
      case 'listItem':
        return (node.content || []).map((c: any) => render(c, depth + 1)).join(' ');
      case 'blockquote':
        return (node.content || []).map((c: any) => `> ${render(c, depth + 1)}`).join('\n');
      case 'codeBlock':
        return '```\n' + (node.content || []).map(text).join('') + '\n```';
      default:
        return (node.content || []).map((c: any) => render(c, depth + 1)).join('');
    }
  }
  return render(doc);
}
