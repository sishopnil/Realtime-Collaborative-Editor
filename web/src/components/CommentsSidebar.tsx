"use client";
import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { Editor } from '@tiptap/react';
import { apiDelete, apiGet, apiPatch, apiPost } from '../lib/api';
import { isRtlLocale, t as tr } from '../i18n';

type Thread = { _id: string; authorId: string; text: string; status: string; createdAt: string; anchor?: { from: number; to: number }; replies?: any[]; reactions?: Record<string, number> };

export default function CommentsSidebar({ documentId, editor, open, onClose, anchors }: { documentId: string; editor: Editor | null; open: boolean; onClose: () => void; anchors: Record<string, { from: number; to: number }> }) {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [loading, setLoading] = useState(false);
  const [sel, setSel] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [q, setQ] = useState('');
  const [highContrast, setHighContrast] = useState(false);
  const [locale, setLocale] = useState<string>('en');
  const listRef = useRef<HTMLDivElement | null>(null);
  const [focusedIndex, setFocusedIndex] = useState<number>(0);

  useEffect(() => {
    if (!open) return;
    refresh();
    const onEvt = (e: any) => {
      if (!open) return;
      const d = e.detail;
      if (!d || d.docId !== documentId) return;
      refresh();
    };
    window.addEventListener('comment-event' as any, onEvt);
    return () => window.removeEventListener('comment-event' as any, onEvt);
  }, [open, documentId]);

  useEffect(() => {
    setLocale(navigator.language || 'en');
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(`comment-drafts:${documentId}`);
      if (raw) setDrafts(JSON.parse(raw));
    } catch {}
  }, [documentId]);

  useEffect(() => {
    try { localStorage.setItem(`comment-drafts:${documentId}`, JSON.stringify(drafts)); } catch {}
  }, [documentId, drafts]);

  async function refresh() {
    setLoading(true);
    try {
      const list = await apiGet<any[]>(`/comments/doc/${documentId}`);
      setThreads(list);
    } finally {
      setLoading(false);
    }
  }

  const filtered = useMemo(() => {
    if (!q) return threads;
    const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    return threads.filter((t) => rx.test(t.text) || (t.replies || []).some((r: any) => rx.test(String(r.text || ''))));
  }, [threads, q]);

  if (!open) return null;
  return (
    <aside role="complementary" aria-label={tr('comments')} dir={isRtlLocale(locale) ? 'rtl' : 'ltr'}
      style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 320, background: highContrast ? '#fff' : '#fff', borderLeft: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: 8, borderBottom: '1px solid #eee' }}>
        <strong style={{ flex: 1 }}>{tr('comments')}</strong>
        <input aria-label={tr('search')} placeholder={tr('search')} value={q} onChange={(e) => setQ(e.target.value)} style={{ flex: 2, fontSize: 12 }} />
        <button onClick={() => setHighContrast((v) => !v)} aria-pressed={highContrast} aria-label={tr('highContrast')}>◑</button>
        <button onClick={() => onClose()} aria-label={tr('close')}>✕</button>
      </div>
      <div style={{ padding: 8, display: 'flex', gap: 6 }}>
        <button onClick={() => filterStatus('open')} aria-label={`${tr('status')}: ${tr('open')}`}>{tr('open')}</button>
        <button onClick={() => filterStatus('resolved')} aria-label={`${tr('status')}: ${tr('resolved')}`}>{tr('resolved')}</button>
        <button onClick={() => filterStatus('')} aria-label={`${tr('status')}: ${tr('all')}`}>{tr('all')}</button>
        <button onClick={exportJson} style={{ marginLeft: 'auto' }}>{tr('export')}</button>
      </div>
      <div ref={listRef} role="list" aria-busy={loading} aria-live="polite" tabIndex={0}
        onKeyDown={(e) => onKeyNav(e)}
        style={{ overflow: 'auto', flex: 1, outline: 'none' }}>
        {loading ? (
          <div style={{ padding: 12, fontSize: 12 }}>{tr('loading')}</div>
        ) : (
          filtered.map((t, idx) => (
            <ThreadItem
              key={t._id}
              t={t}
              index={idx}
              focused={idx === focusedIndex}
              highContrast={highContrast}
              onReply={postReply}
              onResolve={resolve}
              onDelete={remove}
              onJump={() => jumpTo(t)}
              onReact={(e) => react(t, e)}
              draft={drafts[t._id] || ''}
              setDraft={(v) => setDrafts((d) => ({ ...d, [t._id]: v }))}
            />
          ))
        )}
      </div>
      <div style={{ padding: 8, borderTop: '1px solid #eee' }}>
        <NewThread editor={editor} documentId={documentId} onPosted={refresh} locale={locale} />
      </div>
    </aside>
  );

  function filterStatus(s: string) {
    if (!s) return refresh();
    setThreads((prev) => prev.filter((t) => t.status === s));
  }
  async function exportJson() {
    const list = await apiGet<any[]>(`/comments/doc/${documentId}`);
    const blob = new Blob([JSON.stringify(list, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `comments-${documentId}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }
  async function postReply(threadId: string, text: string) {
    await apiPost(`/comments/${threadId}/replies`, { documentId, text, threadId });
    setDrafts((d) => ({ ...d, [threadId]: '' }));
    refresh();
  }
  async function resolve(id: string) {
    await apiPost(`/comments/${id}/resolve`);
    refresh();
  }
  async function remove(id: string) {
    await apiDelete(`/comments/${id}`);
    refresh();
  }
  async function react(t: Thread, emoji: string) {
    await apiPost(`/comments/${t._id}/react`, { emoji });
  }
  function jumpTo(t: Thread) {
    const a = anchors[t._id] || t.anchor;
    if (!a || !editor) return;
    const pos = Math.max(1, Math.min(a.from, editor.state.doc.content.size));
    editor.chain().setTextSelection(pos).scrollIntoView().run();
  }

  function onKeyNav(e: React.KeyboardEvent) {
    if (!filtered.length) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setFocusedIndex((i) => Math.min(filtered.length - 1, i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setFocusedIndex((i) => Math.max(0, i - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const t = filtered[focusedIndex];
      if (t) jumpTo(t);
    }
  }
}

function ThreadItem({ t, index, focused, highContrast, onReply, onResolve, onDelete, onJump, onReact, draft, setDraft }: { t: Thread; index: number; focused: boolean; highContrast: boolean; onReply: (threadId: string, text: string) => void; onResolve: (id: string) => void; onDelete: (id: string) => void; onJump: () => void; onReact: (emoji: string) => void; draft: string; setDraft: (v: string) => void }) {
  const [typing, setTyping] = useState(false);
  const share = () => {
    const url = `${location.origin}${location.pathname}#comment-${t._id}`;
    navigator.clipboard?.writeText(url).catch(() => {});
  };
  return (
    <div role="listitem" id={`comment-${t._id}`} aria-label={`Comment by ${shortId(t.authorId)} at ${new Date(t.createdAt).toLocaleString()}`}
      style={{ borderBottom: '1px solid #eee', padding: 8, outline: focused ? (highContrast ? '2px solid #000' : '2px solid #94a3b8') : 'none', borderRadius: 4 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button onClick={onJump} title={tr('jumpToPosition')} aria-label={tr('jumpToPosition')}>📍</button>
        <strong style={{ fontSize: 12 }}>{shortId(t.authorId)}</strong>
        <span style={{ fontSize: 11, opacity: 0.7 }}>{new Date(t.createdAt).toLocaleString()}</span>
        <span style={{ marginLeft: 'auto', fontSize: 11, padding: '2px 6px', borderRadius: 9999, background: t.status === 'resolved' ? (highContrast ? '#16a34a' : '#dcfce7') : (highContrast ? '#dc2626' : '#fee2e2'), color: highContrast ? '#fff' : undefined }}>{t.status}</span>
      </div>
      <div style={{ fontSize: 13, marginTop: 4, whiteSpace: 'pre-wrap' }} dangerouslySetInnerHTML={{ __html: highlightMentions(t.text) }} />
      {!!t.replies?.length && (
        <div style={{ marginTop: 6, paddingLeft: 16 }}>
          {t.replies!.map((r: any) => (
            <div key={r._id} style={{ borderLeft: '2px solid #eee', paddingLeft: 8, marginBottom: 4 }}>
              <strong style={{ fontSize: 12 }}>{shortId(r.authorId)}</strong> <span style={{ fontSize: 11, opacity: 0.7 }}>{new Date(r.createdAt).toLocaleString()}</span>
              <div style={{ fontSize: 13, whiteSpace: 'pre-wrap' }} dangerouslySetInnerHTML={{ __html: highlightMentions(r.text) }} />
            </div>
          ))}
        </div>
      )}
      <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
        <button onClick={() => onResolve(t._id)} disabled={t.status === 'resolved'} aria-label={tr('resolve')}>{tr('resolve')}</button>
        <button onClick={() => onDelete(t._id)} aria-label={tr('delete')}>{tr('delete')}</button>
        <button onClick={share} aria-label={tr('share')}>{tr('share')}</button>
        <button onClick={() => onReact('👍')}>👍 {(t.reactions?.['👍'] || 0)}</button>
        <button onClick={() => onReact('🎉')}>🎉 {(t.reactions?.['🎉'] || 0)}</button>
      </div>
      <div style={{ marginTop: 6 }}>
        <textarea aria-label={tr('reply')} value={draft} onChange={(e) => { setDraft(e.target.value); setTyping(true); setTimeout(() => setTyping(false), 1000); }} rows={2} placeholder={tr('reply')} style={{ width: '100%', fontSize: 12 }} />
        <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
          <button onClick={() => onReply(t._id, draft)} disabled={!draft.trim()} aria-label={tr('reply')}>{tr('reply')}</button>
          {typing && <span role="status" aria-live="polite" style={{ fontSize: 11, color: '#2563eb' }}>{tr('typing')}</span>}
        </div>
      </div>
    </div>
  );
}

function NewThread({ editor, documentId, onPosted, locale }: { editor: Editor | null; documentId: string; onPosted: () => void; locale: string }) {
  const [text, setText] = useState('');
  useEffect(() => {
    try { const s = localStorage.getItem(`comment-drafts:new:${documentId}`); if (s) setText(s); } catch {}
  }, [documentId]);
  useEffect(() => { try { localStorage.setItem(`comment-drafts:new:${documentId}`, text); } catch {} }, [text, documentId]);
  const post = async () => {
    if (!editor) return;
    const sel = editor.state.selection;
    if (sel.from === sel.to) return;
    await apiPost('/comments', { documentId, text, anchor: { from: sel.from, to: sel.to } });
    setText('');
    onPosted();
  };
  return (
    <div>
      <div style={{ fontSize: 12, marginBottom: 4 }}>{tr('newCommentForSelection')}</div>
      <textarea dir={isRtlLocale(locale) ? 'rtl' : 'ltr'} value={text} onChange={(e) => setText(e.target.value)} rows={3} placeholder={tr('typeAComment')} style={{ width: '100%', fontSize: 12 }} />
      <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
        <button onClick={post} disabled={!text.trim()} aria-label={tr('post')}>{tr('post')}</button>
        <button onClick={() => setText('')} aria-label={tr('clear')}>{tr('clear')}</button>
      </div>
    </div>
  );
}

function shortId(id: string) { return `User ${String(id || '').slice(-4)}`; }
function highlightMentions(text: string) {
  const esc = (s: string) => s.replace(/[&<>]/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;'} as any)[c]);
  const rx = /@([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})/g;
  return esc(text).replace(rx, '<span style="background:#fffbeb;border:1px solid #f59e0b;border-radius:4px;padding:0 2px;">@$1</span>');
}
