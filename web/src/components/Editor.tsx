"use client";
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import './editor.css';
import { t, isRtlLocale } from '../i18n';
import { SlashMenu } from './SlashMenu';

export type EditorValue = { type: 'json'; content: any } | { type: 'html'; content: string };

export type EditorProps = {
  value?: EditorValue;
  onChange?: (value: EditorValue) => void;
  placeholder?: string;
  readOnly?: boolean;
  className?: string;
};

function useToolbarRovingFocus(containerRef: React.RefObject<HTMLElement>) {
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      const buttons = Array.from(el.querySelectorAll('button')) as HTMLButtonElement[];
      const idx = buttons.findIndex((b) => b === document.activeElement);
      if (idx < 0) return;
      e.preventDefault();
      const next = e.key === 'ArrowRight' ? (idx + 1) % buttons.length : (idx - 1 + buttons.length) % buttons.length;
      buttons[next]?.focus();
    };
    el.addEventListener('keydown', onKey);
    return () => el.removeEventListener('keydown', onKey);
  }, [containerRef]);
}

export function EditorToolbar({ editor, onToggleContrast }: { editor: any; onToggleContrast?: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useToolbarRovingFocus(ref);

  const promptLink = useCallback(() => {
    const prev = editor.getAttributes('link').href || '';
    const url = window.prompt('Enter URL', prev || 'https://');
    if (url === null) return;
    if (url === '') return editor.chain().focus().unsetLink().run();
    editor.chain().focus().extendMarkRange('link').setLink({ href: url, target: '_blank', rel: 'noopener noreferrer' }).run();
  }, [editor]);

  return (
    <div className="editor-toolbar" role="toolbar" aria-label={t('toolbar')} ref={ref}>
      <button aria-label={t('bold')} aria-pressed={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()}>
        B
      </button>
      <button aria-label={t('italic')} aria-pressed={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()}>
        I
      </button>
      <button aria-label={t('underline')} aria-pressed={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()}>
        U
      </button>
      <button
        aria-label={t('heading1')}
        aria-pressed={editor.isActive('heading', { level: 1 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
      >
        H1
      </button>
      <button
        aria-label={t('heading2')}
        aria-pressed={editor.isActive('heading', { level: 2 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
      >
        H2
      </button>
      <button aria-label={t('bulletList')} aria-pressed={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()}>
        • List
      </button>
      <button
        aria-label={t('orderedList')}
        aria-pressed={editor.isActive('orderedList')}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      >
        1. List
      </button>
      <button aria-label={t('codeBlock')} aria-pressed={editor.isActive('codeBlock')} onClick={() => editor.chain().focus().toggleCodeBlock().run()}>
        {'<>'}
      </button>
      <button
        aria-label={t('blockquote')}
        aria-pressed={editor.isActive('blockquote')}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
      >
        ❝
      </button>
      <button aria-label={t('link')} aria-pressed={editor.isActive('link')} onClick={promptLink}>
        Link
      </button>
      <button aria-label={t('clear')} onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}>
        Clear
      </button>
      <button aria-label="Toggle high contrast" onClick={onToggleContrast}>HC</button>
    </div>
  );
}

export default function Editor({ value, onChange, placeholder, readOnly, className }: EditorProps) {
  const [showSlash, setShowSlash] = useState(false);
  const [theme, setTheme] = useState<'default' | 'contrast'>(() =>
    (typeof window !== 'undefined' && (localStorage.getItem('editorTheme') as any)) || 'default',
  );
  const extensions = useMemo(
    () => [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        codeBlock: {},
      }),
      Underline,
      Link.configure({ openOnClick: false, autolink: true, protocols: ['http', 'https', 'mailto'] }),
    ],
    [],
  );

  const editor = useEditor({
    extensions,
    editable: !readOnly,
    autofocus: false,
    editorProps: {
      attributes: { 'aria-label': t('editorLabel'), class: 'editor-content', dir: isRtlLocale() ? 'rtl' : 'auto' },
    },
    content:
      value?.type === 'html'
        ? value.content
        : value?.type === 'json'
        ? value.content
        : '<p></p>',
    onUpdate: ({ editor }) => {
      if (!onChange) return;
      const json = editor.getJSON();
      onChange({ type: 'json', content: json });
    },
  });

  // Additional keyboard shortcuts
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

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <div className={["editor-container", className].filter(Boolean).join(' ')} data-theme={theme === 'contrast' ? 'contrast' : undefined}>
      {editor && !readOnly && (
        <EditorToolbar
          editor={editor}
          onToggleContrast={() =>
            setTheme((t) => {
              const n = t === 'default' ? 'contrast' : 'default';
              try {
                localStorage.setItem('editorTheme', n);
              } catch {}
              return n;
            })
          }
        />
      )}
      {/* eslint-disable-next-line @next/next/no-sync-scripts */}
      {mounted ? (
        <EditorContent editor={editor} />
      ) : (
        <div className="editor-content" aria-busy>
          Loading editor...
        </div>
      )}
      {placeholder && !readOnly && editor?.isEmpty && (
        <div aria-hidden className="editor-placeholder">{placeholder}</div>
      )}
      {/* live region for announcements */}
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {editor?.isActive('heading', { level: 1 }) ? 'Heading level 1' : ''}
        {editor?.isActive('heading', { level: 2 }) ? 'Heading level 2' : ''}
        {editor?.isActive('bulletList') ? 'Bullet list' : ''}
        {editor?.isActive('orderedList') ? 'Ordered list' : ''}
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
    </div>
  );
}
