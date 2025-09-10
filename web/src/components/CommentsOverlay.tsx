"use client";
import React, { useEffect, useState } from 'react';
import { isRtlLocale } from '../i18n';
import type { Editor } from '@tiptap/react';

type Thread = { _id: string; anchor?: { from: number; to: number }; authorId: string; text: string; status: string };

export default function CommentsOverlay({ editor, threads, anchors }: { editor: Editor | null; threads: Thread[]; anchors?: Record<string, { from: number; to: number }> }) {
  const [rects, setRects] = useState<Record<string, { left: number; top: number; width: number; height: number; color: string }>>({});
  useEffect(() => {
    if (!editor) return;
    const calc = () => {
      try {
        const box = (editor.view.dom as HTMLElement).getBoundingClientRect();
        const next: any = {};
        for (const t of threads) {
          if (!t.anchor) continue;
          const ov = anchors && anchors[t._id];
          const a = Math.max(1, (ov?.from ?? t.anchor.from) | 0);
          const b = Math.max(1, (ov?.to ?? t.anchor.to) | 0);
          const c1 = editor.view.coordsAtPos(a);
          const c2 = editor.view.coordsAtPos(b);
          const left = Math.min(c1.left, c2.left) - box.left;
          const top = Math.min(c1.top, c2.top) - box.top;
          const width = Math.max(6, Math.abs(c2.left - c1.left));
          const height = Math.max(18, Math.max(c1.bottom, c2.bottom) - Math.min(c1.top, c2.top));
          const color = colorForUser(t.authorId);
          next[t._id] = { left, top, width, height, color };
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
  }, [editor, JSON.stringify(threads)]);
  return (
    <div aria-hidden style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} dir={typeof navigator !== 'undefined' && isRtlLocale(navigator.language) ? 'rtl' : 'ltr'}>
      {Object.entries(rects).map(([id, r]) => (
        <div key={id} style={{ position: 'absolute', left: r.left, top: r.top }}>
          <div style={{ position: 'absolute', left: 0, top: 0, width: r.width, height: r.height, background: r.color, opacity: 0.08, border: `1px solid ${r.color}`, borderRadius: 4 }} />
          <div style={{ position: 'absolute', right: -10, top: -10, background: '#fff', border: `1px solid ${r.color}`, width: 18, height: 18, borderRadius: 10, display: 'grid', placeItems: 'center', fontSize: 10, color: '#111' }}>💬</div>
        </div>
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
