"use client";
import React, { useEffect, useMemo, useRef, useState, forwardRef, useImperativeHandle } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import Collaboration from '@tiptap/extension-collaboration';
import './editor.css';
import { t, isRtlLocale } from '../i18n';
import { SlashMenu } from './SlashMenu';
import * as Y from 'yjs';
import { SimpleYProvider, SyncStatus } from '../lib/yjsProvider';
import RemotePresenceOverlay from './RemotePresenceOverlay';
import CommentsOverlay from './CommentsOverlay';
import CommentsSidebar from './CommentsSidebar';
import { useConnectionMonitor } from '../lib/connection';
import { apiGet, apiPost } from '../lib/api';

export type EditorCollabHandle = { getHTML: () => string | undefined; getJSON: () => any };
export default forwardRef<EditorCollabHandle, { docId: string }>(function EditorCollab({ docId }, ref) {
  const ydocRef = useRef<Y.Doc>();
  const providerRef = useRef<SimpleYProvider>();

  useEffect(() => {
    const prov = new SimpleYProvider({ docId });
    providerRef.current = prov;
    ydocRef.current = prov.ydoc;
    prov.load();
    const unsub = prov.onStatus((s) => setStatus(s));
    return () => {
      prov.flush().catch(() => {});
      prov.ydoc?.destroy();
      unsub?.();
    };
  }, [docId]);

  const extensions = useMemo(
    () => [
      StarterKit.configure({ history: false, heading: { levels: [1, 2, 3] } }),
      Underline,
      Link.configure({ openOnClick: false, autolink: true, protocols: ['http', 'https', 'mailto'] }),
      Collaboration.configure({ document: ydocRef.current!, field: 'prosemirror' }),
    ],
    [],
  );

  const [status, setStatus] = useState<SyncStatus>({ state: 'idle', pending: 0, offline: false });
  const health = useConnectionMonitor();
  const [showSlash, setShowSlash] = useState(false);
  const [typing, setTyping] = useState<Record<string, number>>({});
  const [presences, setPresences] = useState<Record<string, { anchor: number; head: number; typing?: boolean; ts: number }>>({});
  const [theme, setTheme] = useState<'default' | 'contrast'>(() =>
    (typeof window !== 'undefined' && (localStorage.getItem('editorTheme') as any)) || 'default',
  );
  const [focusMode, setFocusMode] = useState(false);
  const [claims, setClaims] = useState<Record<string, { claimId: string; from: number; to: number; userId: string; ts: number; ttl: number }>>({});
  const [conflicts, setConflicts] = useState<{ at: number; with: string; severity: 'low' | 'med' | 'high' }[]>([]);
  const [showHelp, setShowHelp] = useState<boolean>(() => {
    try { return localStorage.getItem('collab-help-dismissed') ? false : true; } catch { return true; }
  });
  const [threads, setThreads] = useState<any[]>([]);
  const [anchors, setAnchors] = useState<Record<string, { from: number; to: number }>>({});
  const [toast, setToast] = useState<string | null>(null);
  const [showComments, setShowComments] = useState(false);
  const editor = useEditor({
    extensions,
    autofocus: false,
    editorProps: {
      attributes: { 'aria-label': 'Collaborative editor', class: 'editor-content', dir: isRtlLocale() ? 'rtl' : 'auto' },
    },
  });
  const [heat, setHeat] = useState<number[]>(() => Array.from({ length: 20 }, () => 0));
  const localTypingAt = useRef<number>(0);
  const [conflictHint, setConflictHint] = useState<string | null>(null);
  const [srMsg, setSrMsg] = useState<string>('');
  const [isMobile, setIsMobile] = useState<boolean>(typeof window !== 'undefined' ? window.innerWidth < 640 : false);
  const [prefs, setPrefs] = useState<{ voice: boolean; notify: boolean; compact: boolean }>(() => {
    try {
      const raw = typeof window !== 'undefined' ? localStorage.getItem('collab-prefs') : null;
      return raw ? JSON.parse(raw) : { voice: false, notify: false, compact: true };
    } catch {
      return { voice: false, notify: false, compact: true };
    }
  });

  // Toggle read-only when offline or unauthorized
  useEffect(() => {
    if (!editor) return;
    const ro = (status as any).readOnly || status.offline;
    editor.setEditable(!ro);
  }, [editor, status]);

  useEffect(() => {
    if (!editor) return;
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key.toLowerCase() === 'u') {
        e.preventDefault();
        editor.chain().focus().toggleUnderline().run();
      } else if (e.altKey && /[1-6]/.test(e.key)) {
        e.preventDefault();
        editor.chain().focus().toggleHeading({ level: parseInt(e.key, 10) as any }).run();
      } else if (e.ctrlKey && e.key === '/') {
        e.preventDefault();
        setShowSlash((v) => !v);
      } else {
        // mark typing for peers
        providerRef.current?.sendPresence({ anchor: editor.state.selection.anchor, head: editor.state.selection.head, typing: true });
        // clear typing after short idle
        setTimeout(() => providerRef.current?.sendPresence({ anchor: editor.state.selection.anchor, head: editor.state.selection.head, typing: false }), 1200);
        localTypingAt.current = Date.now();
      }
    };
    const dom = editor.view.dom as HTMLElement;
    dom.addEventListener('keydown', handler);
    return () => dom.removeEventListener('keydown', handler);
  }, [editor]);

  // Long-press to claim selection (mobile)
  useEffect(() => {
    if (!editor) return;
    let timer: any = null;
    const onTouchStart = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        const sel = editor.state.selection;
        providerRef.current?.claimSection(sel.from, sel.to, 60);
      }, 700);
    };
    const onTouchEnd = () => clearTimeout(timer);
    const dom = editor.view.dom as HTMLElement;
    dom.addEventListener('touchstart', onTouchStart);
    dom.addEventListener('touchend', onTouchEnd);
    dom.addEventListener('touchcancel', onTouchEnd);
    return () => {
      dom.removeEventListener('touchstart', onTouchStart);
      dom.removeEventListener('touchend', onTouchEnd);
      dom.removeEventListener('touchcancel', onTouchEnd);
    };
  }, [editor]);

  // Screen reader and optional voice announcements
  useEffect(() => {
    const announce = (msg: string) => {
      setSrMsg(msg);
      try {
        if (prefs.voice && typeof window !== 'undefined' && 'speechSynthesis' in window) {
          const u = new SpeechSynthesisUtterance(msg);
          u.rate = 1.1;
          window.speechSynthesis.speak(u);
        }
      } catch {}
    };
    const onPresenceAnnounce = (e: any) => {
      const p = e.detail?.presence;
      if (!p?.userId) return;
      if (p.typing) announce(`${userLabel(p.userId)} typing`);
      else announce(`${userLabel(p.userId)} moved cursor`);
    };
    window.addEventListener('doc-presence' as any, onPresenceAnnounce);
    const resize = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener('resize', resize);
    return () => {
      window.removeEventListener('doc-presence' as any, onPresenceAnnounce);
      window.removeEventListener('resize', resize);
    };
  }, [prefs.voice]);

  // Conflict detection and guidance
  useEffect(() => {
    if (!editor) return;
    const sel = editor.state.selection;
    const head = sel.head | 0;
    let best: { uid: string; dist: number; typing: boolean } | null = null;
    for (const [uid, p] of Object.entries(presences)) {
      const dist = Math.abs((p.head | 0) - head);
      if (best == null || dist < best.dist) best = { uid, dist, typing: !!p.typing };
    }
    if (!best) {
      setConflictHint(null);
      return;
    }
    const localTyping = Date.now() - localTypingAt.current < 1500;
    const bothTyping = localTyping && best.typing;
    const inClaim = Object.values(claims).some((c) => head >= c.from && head <= c.to && !!best && best.uid !== c.userId);
    const near = best.dist < 20 || inClaim;
    if (!near) {
      setConflictHint(null);
      return;
    }
    const severity: 'low' | 'med' | 'high' = inClaim ? 'high' : best.dist < 5 ? (bothTyping ? 'high' : 'med') : 'low';
    setConflictHint(
      inClaim
        ? `This section is claimed by ${userLabel(Object.values(claims).find((c) => head >= c.from && head <= c.to)!.userId)}. Consider editing elsewhere.`
        : bothTyping
        ? `You and ${userLabel(best.uid)} are editing nearby. Consider turn-taking.`
        : `You are near ${userLabel(best.uid)}. Minor conflict risk.`,
    );
    try { providerRef.current?.sendMetric('conflict_detected'); } catch {}
    if (severity !== 'low') {
      setConflicts((prev) => [{ at: Date.now(), with: best!.uid, severity }, ...prev].slice(0, 10));
    }
  }, [editor, presences, claims]);

  // Send selection presence on transactions
  useEffect(() => {
    if (!editor) return;
    const last = { a: 0, h: 0, t: 0 };
    const unsub = editor.on('transaction', () => {
      const sel = editor.state.selection;
      const a = sel.anchor | 0;
      const h = sel.head | 0;
      const now = Date.now();
      const moved = Math.abs(a - last.a) + Math.abs(h - last.h) >= 3;
      const timeOk = now - last.t >= 150;
      if (moved || timeOk) {
        providerRef.current?.sendPresence({ anchor: a, head: h });
        last.a = a;
        last.h = h;
        last.t = now;
      }
    });
    return () => { (unsub as any)?.(); };
  }, [editor]);

  // Listen for presence updates to show typing indicators
  useEffect(() => {
    const onPresence = (e: any) => {
      const p = e.detail?.presence as { userId: string; typing?: boolean; anchor: number; head: number; ts?: number } | undefined;
      if (!p?.userId) return;
      setPresences((prev) => ({ ...prev, [p.userId]: { anchor: p.anchor|0, head: p.head|0, typing: !!p.typing, ts: p.ts || Date.now() } }));
      setTyping((prev) => {
        const next = { ...prev };
        if (p.typing) next[p.userId] = Date.now();
        else delete next[p.userId];
        return next;
      });
      if (p.typing) setHeat((h) => bumpHeat(h));
    };
    const onPresenceList = (e: any) => {
      const list = (e.detail?.presenceList || e.detail?.list) as any[] | undefined;
      if (!Array.isArray(list)) return;
      setPresences((prev) => {
        const next = { ...prev } as any;
        for (const p of list) if (p?.userId) next[p.userId] = { anchor: p.anchor|0, head: p.head|0, typing: !!p.typing, ts: p.ts || Date.now() };
        return next;
      });
    };
    window.addEventListener('doc-presence' as any, onPresence);
    window.addEventListener('doc-presence-list' as any, onPresenceList);
    const onClaimed = (e: any) => {
      const c = e.detail?.claim;
      if (!c?.claimId) return;
      setClaims((prev) => ({ ...prev, [c.claimId]: c }));
    };
    const onReleased = (e: any) => {
      const r = e.detail?.release;
      if (!r?.claimId) return;
      setClaims((prev) => {
        const next = { ...prev } as any;
        delete next[r.claimId];
        return next;
      });
    };
    const onClaimList = (e: any) => {
      const arr = e.detail?.claims as any[];
      if (!Array.isArray(arr)) return;
      setClaims(() => Object.fromEntries(arr.map((c) => [c.claimId, c])));
    };
    window.addEventListener('doc-section-claimed' as any, onClaimed);
    window.addEventListener('doc-section-released' as any, onReleased);
    window.addEventListener('doc-section-list' as any, onClaimList);
    const clean = setInterval(() => {
      setTyping((prev) => {
        const now = Date.now();
        const next: Record<string, number> = {};
        for (const [k, v] of Object.entries(prev)) if (now - v < 2000) next[k] = v;
        return next;
      });
      // Evict stale presences (idle > 60s)
      setPresences((prev) => {
        const now = Date.now();
        const out: typeof prev = {} as any;
        for (const [k, v] of Object.entries(prev)) if (now - (v.ts || 0) < 60000) out[k] = v;
        return out;
      });
    }, 2000);
    return () => {
      window.removeEventListener('doc-presence' as any, onPresence);
      window.removeEventListener('doc-presence-list' as any, onPresenceList);
      window.removeEventListener('doc-section-claimed' as any, onClaimed);
      window.removeEventListener('doc-section-released' as any, onReleased);
      window.removeEventListener('doc-section-list' as any, onClaimList);
      clearInterval(clean);
    };
  }, []);

  // Notifications for section claims (opt-in)
  useEffect(() => {
    const onClaimed = (e: any) => {
      const c = e.detail?.claim;
      if (!c?.claimId) return;
      try {
        if (prefs.notify && 'Notification' in window) {
          if (Notification.permission === 'granted') new Notification(`Section claimed by ${userLabel(c.userId)}`);
          else if (Notification.permission !== 'denied') Notification.requestPermission();
        }
      } catch {}
    };
    window.addEventListener('doc-section-claimed' as any, onClaimed);
    return () => window.removeEventListener('doc-section-claimed' as any, onClaimed);
  }, [prefs.notify]);

  useImperativeHandle(
    ref,
    () => ({
      getHTML: () => editor?.getHTML(),
      getJSON: () => editor?.getJSON(),
    }),
    [editor],
  );

  return (
    <div className="editor-container" data-theme={theme === 'contrast' ? 'contrast' : undefined}>
      <div className="editor-toolbar" role="toolbar" aria-label={t('toolbar')}>
        <button aria-label={t('bold')} aria-pressed={editor?.isActive('bold')} onClick={() => editor?.chain().focus().toggleBold().run()}>
          B
        </button>
        <button aria-label={t('italic')} aria-pressed={editor?.isActive('italic')} onClick={() => editor?.chain().focus().toggleItalic().run()}>
          I
        </button>
        <button aria-label={t('underline')} aria-pressed={editor?.isActive('underline')} onClick={() => editor?.chain().focus().toggleUnderline().run()}>
          U
        </button>
        <button aria-label={t('undo')} onClick={() => editor?.commands.undo()}>{t('undo')}</button>
        <button aria-label={t('redo')} onClick={() => editor?.commands.redo()}>{t('redo')}</button>
        <button
          aria-label="Toggle high contrast"
          onClick={() =>
            setTheme((t) => {
              const n = t === 'default' ? 'contrast' : 'default';
              try {
                localStorage.setItem('editorTheme', n);
              } catch {}
              return n;
            })
          }
        >
          HC
        </button>
        <button aria-label="Focus mode" onClick={() => setFocusMode((v) => !v)}>{focusMode ? 'Unfocus' : 'Focus'}</button>
        <button
          aria-label="Claim section"
          onClick={() => {
            if (!editor) return;
            const sel = editor.state.selection;
            providerRef.current?.claimSection(sel.from, sel.to, 60);
          }}
        >
          Claim
        </button>
        <div style={{ display: 'inline-flex', gap: 6, marginLeft: 8 }}>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
            <input type="checkbox" checked={prefs.voice} onChange={(e) => updatePrefs({ voice: e.target.checked })} /> Voice
          </label>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
            <input type="checkbox" checked={prefs.notify} onChange={(e) => updatePrefs({ notify: e.target.checked })} /> Notify
          </label>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
            <input type="checkbox" checked={prefs.compact} onChange={(e) => updatePrefs({ compact: e.target.checked })} /> Compact
          </label>
        </div>
        <button aria-label="Focus mode" onClick={() => setFocusMode((v) => !v)}>{focusMode ? 'Unfocus' : 'Focus'}</button>
        <button
          aria-label="Claim section"
          onClick={() => {
            if (!editor) return;
            const sel = editor.state.selection;
            providerRef.current?.claimSection(sel.from, sel.to, 60);
          }}
        >
          Claim
        </button>
        <span aria-live="polite" style={{ marginLeft: 'auto', fontSize: 12 }}>
          {status.offline
            ? t('offline')
            : status.state === 'syncing'
            ? t('syncing')
            : status.state === 'backoff'
            ? `${t('reconnect')} ${Math.ceil(((status as any).delayMs || 0) / 1000)} ${t('seconds')}`
            : (status as any).readOnly
            ? t('readOnly')
            : t('allSaved')}
          {` · Pending: ${status.pending}`}
        </span>
        {(status.offline || status.state === 'backoff') && (
          <button aria-label={t('retry')} onClick={() => providerRef.current?.retryNow()} style={{ marginLeft: 8 }}>
            {t('retry')}
          </button>
        )}
        <button aria-label={t('export')} onClick={() => exportBackup(provideDoc())}>{t('export')}</button>
        <button aria-label="Comments" onClick={() => setShowComments((v) => !v)}>{showComments ? 'Hide' : 'Comments'}</button>
        <button
          aria-label="Add comment"
          onClick={async () => {
            if (!editor) return;
            const sel = editor.state.selection;
            if (sel.from === sel.to) return alert('Select text to comment');
            const text = window.prompt('Comment');
            if (!text) return;
            try {
              const body = { documentId: docId, text, anchor: { from: sel.from, to: sel.to } };
              await apiPost('/comments', body);
              await refreshThreads();
            } catch (e) { console.warn(e); }
          }}
        >
          Comment
        </button>
      </div>
      {showHelp && (
        <div role="region" aria-label="Collaboration tips" style={{ margin: '6px 12px', padding: 8, border: '1px solid #ddd', borderRadius: 6, background: '#f8fafc', fontSize: 12 }}>
          <strong>Tips:</strong> Use Claim to softly reserve a section. Turn on Voice for spoken typing alerts. Press Enter on a user in the list to jump to their cursor. Long-press on mobile to claim.
          <button style={{ marginLeft: 8 }} onClick={() => { setShowHelp(false); try { localStorage.setItem('collab-help-dismissed', '1'); } catch {} }}>Got it</button>
        </div>
      )}
      {/* Presence list with keyboard navigation */}
      {Object.keys(presences).length > 0 && (
        <div
          role="listbox"
          aria-label="Active collaborators"
          style={{ display: 'flex', gap: 6, flexWrap: 'wrap', fontSize: 12, margin: '6px 12px' }}
        >
          {Object.entries(presences).map(([uid, p]) => (
            <div
              key={uid}
              role="option"
              aria-selected={false}
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter') jumpToUser(uid);
              }}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '2px 6px', border: '1px solid #ddd', borderRadius: 9999 }}
            >
              <span style={{ width: 8, height: 8, borderRadius: 99, background: colorForUser(uid), opacity: Date.now() - (p.ts || 0) > 10000 ? 0.5 : 1 }} />
              <span>{userLabel(uid)}</span>
            </div>
          ))}
        </div>
      )}
      {Object.keys(typing).length > 0 && (
        <div role="status" aria-live="polite" style={{ fontSize: 12, color: '#2563eb', marginTop: 4 }}>
          {`${Object.keys(typing).length} user(s) typing…`}
        </div>
      )}
      {/* Conflict guidance */}
      {conflictHint && (
        <div role="status" aria-live="polite" style={{ margin: '6px 12px', padding: '6px 8px', border: '1px solid #f59e0b', background: '#fffbeb', color: '#92400e', borderRadius: 6, fontSize: 12 }}>
          {conflictHint}
        </div>
      )}
      {/* Activity heat map */}
      <div aria-hidden style={{ display: 'flex', gap: 2, margin: '4px 12px' }}>
        {heat.map((v, i) => (
          <div key={i} style={{ width: 6, height: 10, background: `rgba(37,99,235,${Math.min(1, v / 8)})`, borderRadius: 2 }} />
        ))}
      </div>
      {/* Conflict history */}
      {conflicts.length > 0 && (
        <div aria-label="Conflict history" style={{ margin: '6px 12px', fontSize: 12 }}>
          <span style={{ opacity: 0.7 }}>Recent conflicts:</span>{' '}
          {conflicts.slice(0, 5).map((c, i) => (
            <span key={i} style={{ marginRight: 8 }}>
              [{c.severity}] with {userLabel(c.with)} {timeAgo(c.at)}
            </span>
          ))}
        </div>
      )}
      {/* Contribution ranking */}
      <ContribBar presences={presences} typing={typing} />
      {/* Active users list */}
      {Object.keys(presences).length > 0 && (
        <div aria-label="Active users" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', fontSize: 12, margin: '6px 12px' }}>
          <span style={{ opacity: 0.7 }}>Active: {Object.keys(presences).length}</span>
          {Object.entries(presences).map(([uid, p]) => {
            const idle = Date.now() - (p.ts || 0) > 10000;
            const color = colorForUser(uid);
            const label = userLabel(uid);
            return (
              <span key={uid} title={idle ? `Idle • last seen ${timeAgo(p.ts)}` : 'Online'} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '2px 6px', border: '1px solid #ddd', borderRadius: 9999 }}>
                <span style={{ width: 8, height: 8, borderRadius: 99, background: color, opacity: idle ? 0.5 : 1 }} />
                <span style={{ opacity: idle ? 0.65 : 1 }}>{label}</span>
              </span>
            );
          })}
        </div>
      )}
      {health.status !== 'ok' && (
        <div role="status" style={{ color: '#b45309', fontSize: 12, margin: '8px 0' }}>
          {health.status === 'degraded' ? 'Service degraded; syncing may be delayed.' : 'Service down; working offline.'}
          {health.rttMs ? ` · RTT: ${Math.round(health.rttMs)}ms` : ''}
        </div>
      )}
      <div style={{ position: 'relative' }}>
        <EditorContent editor={editor} />
        <RemotePresenceOverlay editor={editor} presences={presences} compact={prefs.compact || isMobile} />
        {focusMode && editor && <FocusOverlay editor={editor} />}
        {editor && <ClaimsOverlay editor={editor} claims={Object.values(claims)} />}
        {editor && threads.length > 0 && <CommentsOverlay editor={editor} threads={threads} anchors={anchors} />}
        {toast && (
          <div role="status" aria-live="polite" style={{ position: 'absolute', right: 8, bottom: 8, background: '#111827', color: '#fff', padding: '8px 10px', borderRadius: 6, boxShadow: '0 6px 24px rgba(0,0,0,0.2)', fontSize: 12 }}>
            {toast}
          </div>
        )}
        {editor && showComments && (
          <CommentsSidebar documentId={docId} editor={editor} open={showComments} onClose={() => setShowComments(false)} anchors={anchors} />
        )}
      </div>
      {showSlash && editor && (
        <SlashMenu
          items={[
            { id: 'p', label: 'Paragraph', action: () => editor.chain().focus().setParagraph().run() },
            { id: 'h1', label: 'Heading 1', action: () => editor.chain().focus().setHeading({ level: 1 }).run() },
            { id: 'h2', label: 'Heading 2', action: () => editor.chain().focus().setHeading({ level: 2 }).run() },
            { id: 'ul', label: 'Bullet list', action: () => editor.chain().focus().toggleBulletList().run() },
            { id: 'ol', label: 'Ordered list', action: () => editor.chain().focus().toggleOrderedList().run() },
            { id: 'code', label: 'Code block', action: () => editor.chain().focus().toggleCodeBlock().run() },
            { id: 'quote', label: 'Blockquote', action: () => editor.chain().focus().toggleBlockquote().run() },
          ]}
          onClose={() => setShowSlash(false)}
        />
      )}
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {editor?.isActive('heading', { level: 1 }) ? 'Heading level 1' : ''}
        {editor?.isActive('heading', { level: 2 }) ? 'Heading level 2' : ''}
        {editor?.isActive('bulletList') ? 'Bullet list' : ''}
        {editor?.isActive('orderedList') ? 'Ordered list' : ''}
        {srMsg}
      </div>
    </div>
  );

  function provideDoc() {
    return ydocRef.current!;
  }
  function exportBackup(doc: Y.Doc) {
    const merged = Y.encodeStateAsUpdate(doc);
    const b64 = btoa(String.fromCharCode(...Array.from(merged)));
    const blob = new Blob([b64], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `doc-${docId}-backup.txt`;
    a.click();
    URL.revokeObjectURL(a.href);
  }
  async function refreshThreads() {
    try {
      const list = await apiGet<any[]>(`/comments/doc/${docId}`);
      setThreads(list);
    } catch {}
  }

  useEffect(() => {
    refreshThreads();
  }, [docId]);

  useEffect(() => {
    const onCommentEvt = (e: any) => {
      if (e.detail?.docId !== docId) return;
      refreshThreads();
    };
    window.addEventListener('comment-event' as any, onCommentEvt);
    return () => window.removeEventListener('comment-event' as any, onCommentEvt);
  }, [docId]);

  // Initialize anchors map from loaded threads
  useEffect(() => {
    const next: Record<string, { from: number; to: number }> = {};
    for (const t of threads) if (t.anchor) next[t._id] = { from: t.anchor.from, to: t.anchor.to };
    setAnchors(next);
  }, [threads]);

  // Map anchors through document changes using transaction.mapping
  useEffect(() => {
    if (!editor) return;
    const unsub = editor.on('transaction', ({ transaction }: any) => {
      try {
        if (!transaction || !transaction.mapping) return;
        setAnchors((prev) => {
          const next: any = { ...prev };
          for (const [id, a] of Object.entries(prev)) {
            const from = transaction.mapping.map((a as any).from, -1);
            const to = transaction.mapping.map((a as any).to, 1);
            next[id] = { from, to };
          }
          return next;
        });
      } catch {}
    });
    return () => { (unsub as any)?.(); };
  }, [editor]);

  // Real-time notifications
  useEffect(() => {
    const onNotify = (e: any) => {
      const d = e.detail || {};
      const text = d?.type === 'mention' ? 'You were mentioned' : d?.type === 'reply' ? 'New reply' : 'Notification';
      setToast(`${text}${d?.text ? `: ${d.text}` : ''}`);
      if (prefs.voice) {
        try {
          const u = new SpeechSynthesisUtterance(text);
          window.speechSynthesis.speak(u);
        } catch {}
      }
      setTimeout(() => setToast(null), 4000);
    };
    window.addEventListener('notify' as any, onNotify);
    return () => window.removeEventListener('notify' as any, onNotify);
  }, [prefs.voice]);
  function updatePrefs(partial: Partial<{ voice: boolean; notify: boolean; compact: boolean }>) {
    setPrefs((prev) => {
      const next = { ...prev, ...partial } as any;
      try { localStorage.setItem('collab-prefs', JSON.stringify(next)); } catch {}
      return next;
    });
  }
  function jumpToUser(uid: string) {
    try {
      const p = presences[uid];
      if (!editor || !p) return;
      const pos = Math.max(1, Math.min(p.head | 0, editor.state.doc.content.size));
      editor.chain().setTextSelection(pos).scrollIntoView().run();
    } catch {}
  }
  function handlePresenceListKeys(e: React.KeyboardEvent<HTMLDivElement>) {
    const container = e.currentTarget;
    const items = Array.from(container.querySelectorAll('[role="option"]')) as HTMLElement[];
    const i = items.findIndex((el) => el === document.activeElement);
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      const next = items[Math.min(items.length - 1, i + 1)] || items[0];
      next?.focus();
      e.preventDefault();
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      const prev = items[Math.max(0, i - 1)] || items[items.length - 1];
      prev?.focus();
      e.preventDefault();
    }
  }
  function userLabel(uid: string) {
    return `User ${uid.slice(-4)}`;
  }
  function colorForUser(uid: string) {
    let h = 0;
    for (let i = 0; i < uid.length; i++) h = (h * 31 + uid.charCodeAt(i)) | 0;
    const hue = Math.abs(h) % 360;
    return `hsl(${hue}, 85%, 55%)`;
  }
  function timeAgo(ts?: number) {
    if (!ts) return '';
    const s = Math.max(1, Math.round((Date.now() - ts) / 1000));
    if (s < 60) return `${s}s ago`;
    const m = Math.round(s / 60);
    if (m < 60) return `${m}m ago`;
    const h = Math.round(m / 60);
    return `${h}h ago`;
  }
  function bumpHeat(h: number[]) {
    const nowSlot = Math.floor(Date.now() / 3000); // 3s slots
    const base = [...h];
    // decay and rotate occasionally
    if (!('heatSlot' in (bumpHeat as any)) || (bumpHeat as any).slot !== nowSlot) {
      (bumpHeat as any).slot = nowSlot;
      base.shift();
      base.push(Math.max(0, Math.round((base[base.length - 1] || 0) * 0.6)));
    }
    base[base.length - 1] = (base[base.length - 1] || 0) + 1;
    return base;
  }
});

function FocusOverlay({ editor }: { editor: any }) {
  const [rect, setRect] = React.useState<{ left: number; top: number; width: number; height: number } | null>(null);
  React.useEffect(() => {
    if (!editor) return;
    const calc = () => {
      try {
        const sel = editor.state.selection;
        const c1 = editor.view.coordsAtPos(sel.from);
        const c2 = editor.view.coordsAtPos(sel.to);
        const box = (editor.view.dom as HTMLElement).getBoundingClientRect();
        const left = Math.min(c1.left, c2.left) - box.left - 6;
        const top = Math.min(c1.top, c2.top) - box.top - 6;
        const width = Math.max(12, Math.abs(c2.left - c1.left) + 12);
        const height = Math.max(22, Math.max(c1.bottom, c2.bottom) - Math.min(c1.top, c2.top) + 12);
        setRect({ left, top, width, height });
      } catch {}
    };
    calc();
    const unsub = editor.on('transaction', calc);
    window.addEventListener('resize', calc);
    return () => {
      (unsub as any)?.();
      window.removeEventListener('resize', calc);
    };
  }, [editor]);
  if (!rect) return null;
  return (
    <div aria-hidden style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.18)' }} />
      <div style={{ position: 'absolute', left: rect.left, top: rect.top, width: rect.width, height: rect.height, border: '2px solid #2563eb', borderRadius: 8, boxShadow: '0 0 0 9999px rgba(0,0,0,0.18)', background: 'transparent' }} />
    </div>
  );
}

function ClaimsOverlay({ editor, claims }: { editor: any; claims: { claimId: string; from: number; to: number; userId: string; ts: number; ttl: number }[] }) {
  const [rects, setRects] = React.useState<Record<string, { left: number; top: number; width: number; height: number; color: string; label: string }>>({});
  React.useEffect(() => {
    if (!editor) return;
    const calc = () => {
      try {
        const box = (editor.view.dom as HTMLElement).getBoundingClientRect();
        const next: any = {};
        for (const c of claims) {
          const c1 = editor.view.coordsAtPos(Math.max(1, c.from));
          const c2 = editor.view.coordsAtPos(Math.max(1, c.to));
          const left = Math.min(c1.left, c2.left) - box.left;
          const top = Math.min(c1.top, c2.top) - box.top;
          const width = Math.max(6, Math.abs(c2.left - c1.left));
          const height = Math.max(18, Math.max(c1.bottom, c2.bottom) - Math.min(c1.top, c2.top));
          next[c.claimId] = { left, top, width, height, color: colorForUser(c.userId), label: `Claimed by ${c.userId.slice(-4)}` };
        }
        setRects(next);
      } catch {}
    };
    calc();
    const unsub = editor.on('transaction', calc);
    window.addEventListener('resize', calc);
    const t = setInterval(calc, 2000);
    return () => {
      (unsub as any)?.();
      window.removeEventListener('resize', calc);
      clearInterval(t);
    };
  }, [editor, JSON.stringify(claims)]);
  return (
    <div aria-hidden style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      {Object.entries(rects).map(([id, r]) => (
        <div key={id} style={{ position: 'absolute', left: r.left, top: r.top }}>
          <div style={{ position: 'absolute', left: 0, top: 0, width: r.width, height: r.height, background: r.color, opacity: 0.08, border: `1px dashed ${r.color}`, borderRadius: 6 }} />
          <div style={{ position: 'absolute', left: 0, top: -18, fontSize: 10, padding: '0 4px', background: 'rgba(255,255,255,0.95)', border: `1px solid ${r.color}`, borderRadius: 6 }}>{r.label}</div>
        </div>
      ))}
    </div>
  );
}

function ContribBar({ presences, typing }: { presences: Record<string, { anchor: number; head: number; typing?: boolean; ts: number }>; typing: Record<string, number> }) {
  const [counts, setCounts] = React.useState<Record<string, number>>({});
  React.useEffect(() => {
    const now = Date.now();
    const next = { ...counts } as any;
    for (const uid of Object.keys(typing)) {
      if (now - typing[uid] < 1500) next[uid] = (next[uid] || 0) + 1;
    }
    // decay
    for (const k of Object.keys(next)) next[k] = Math.max(0, Math.round(next[k] * 0.98));
    setCounts(next);
    const id = setTimeout(() => {}, 0);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typing]);
  const items = Object.entries(counts)
    .filter(([uid, v]) => v > 0 && presences[uid])
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  if (items.length === 0) return null;
  return (
    <div aria-label="Top contributors" style={{ display: 'flex', gap: 8, alignItems: 'center', margin: '6px 12px', fontSize: 12 }}>
      <span style={{ opacity: 0.7 }}>Top activity:</span>
      {items.map(([uid, v]) => (
        <span key={uid} title={`Score ${v}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '2px 6px', border: '1px solid #ddd', borderRadius: 9999 }}>
          <span style={{ width: 8, height: 8, borderRadius: 99, background: colorForUser(uid) }} />
          {`User ${uid.slice(-4)}`} <strong>{v}</strong>
        </span>
      ))}
    </div>
  );
}

function colorForUser(uid: string) {
  let h = 0;
  for (let i = 0; i < uid.length; i++) h = (h * 31 + uid.charCodeAt(i)) | 0;
  const hue = Math.abs(h) % 360;
  return `hsl(${hue}, 85%, 55%)`;
}
