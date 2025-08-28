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
  const [showSlash, setShowSlash] = useState(false);
  const [theme, setTheme] = useState<'default' | 'contrast'>(() =>
    (typeof window !== 'undefined' && (localStorage.getItem('editorTheme') as any)) || 'default',
  );
  const editor = useEditor({
    extensions,
    autofocus: false,
    editorProps: {
      attributes: { 'aria-label': 'Collaborative editor', class: 'editor-content', dir: isRtlLocale() ? 'rtl' : 'auto' },
    },
  });

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
      }
    };
    const dom = editor.view.dom as HTMLElement;
    dom.addEventListener('keydown', handler);
    return () => dom.removeEventListener('keydown', handler);
  }, [editor]);

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
        <span aria-live="polite" style={{ marginLeft: 'auto', fontSize: 12 }}>
          {status.offline ? t('offline') : status.state === 'syncing' ? t('syncing') : status.state === 'backoff' ? `${t('reconnect')} ${(status as any).delayMs / 1000} ${t('seconds')}` : t('allSaved')}
          {` · Pending: ${status.pending}`}
        </span>
        <button aria-label={t('export')} onClick={() => exportBackup(provideDoc())}>{t('export')}</button>
      </div>
      <EditorContent editor={editor} />
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
});
