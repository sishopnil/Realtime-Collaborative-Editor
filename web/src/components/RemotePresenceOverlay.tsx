"use client";
import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { Editor } from '@tiptap/react';

type Presence = { anchor: number; head: number; typing?: boolean; ts: number };

export default function RemotePresenceOverlay({ editor, presences, compact }: { editor: Editor | null; presences: Record<string, Presence>; compact?: boolean }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [positions, setPositions] = useState<Record<string, { left: number; top: number; color: string; label: string; idle: boolean; typing?: boolean; sels?: { left: number; top: number; width: number; height: number }[] }>>({});
  // smoothing state and trails
  const targets = useRef<Record<string, { left: number; top: number }>>({});
  const smooth = useRef<Record<string, { left: number; top: number }>>({});
  const trails = useRef<Record<string, { left: number; top: number; t: number }[]>>({});
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!editor) return;
    const calc = () => {
      try {
        const box = (editor.view.dom as HTMLElement).getBoundingClientRect();
        const next: Record<string, any> = {};
        for (const [uid, p] of Object.entries(presences)) {
          const pos = safeCoords(editor, p.head);
          if (!pos) continue;
          const color = colorForUser(uid);
          const label = userLabel(uid);
          const idle = Date.now() - (p.ts || 0) > 10000;
          const tx = pos.left - box.left;
          const ty = pos.top - box.top;
          targets.current[uid] = { left: tx, top: ty };
          // init smooth to first target if missing
          if (!smooth.current[uid]) smooth.current[uid] = { left: tx, top: ty };
          const sels = selectionRects(editor, p.anchor, p.head, box);
          next[uid] = { left: smooth.current[uid].left, top: smooth.current[uid].top, color, label, idle, typing: !!p.typing, sels };
        }
        // basic overlap resolution
        const byKey = new Map<string, string[]>();
        for (const [uid, v] of Object.entries(next)) {
          const key = `${Math.round(v.left)}:${Math.round(v.top)}`;
          const arr = byKey.get(key) || [];
          arr.push(uid);
          byKey.set(key, arr);
        }
        for (const arr of byKey.values()) {
          if (arr.length <= 1) continue;
          arr.sort();
          arr.forEach((uid, i) => {
            next[uid].left += i * 8;
            next[uid].top += i * 2;
          });
        }
        setPositions(next);
      } catch {}
    };
    calc();
    // animation loop for interpolation + trails
    const animate = () => {
      const nextPositions: typeof positions = {} as any;
      const box = (editor.view.dom as HTMLElement).getBoundingClientRect();
      for (const [uid, tgt] of Object.entries(targets.current)) {
        const s = smooth.current[uid] || { left: tgt.left, top: tgt.top };
        const nx = s.left + (tgt.left - s.left) * 0.25;
        const ny = s.top + (tgt.top - s.top) * 0.25;
        smooth.current[uid] = { left: nx, top: ny };
        const color = colorForUser(uid);
        const label = userLabel(uid);
        const idle = false;
        nextPositions[uid] = { left: nx, top: ny, color, label, idle, typing: presences[uid]?.typing, sels: positions[uid]?.sels } as any;
        // update trail
        const arr = trails.current[uid] || [];
        arr.push({ left: nx, top: ny, t: Date.now() });
        while (arr.length > 12) arr.shift();
        trails.current[uid] = arr;
      }
      setPositions((prev) => Object.keys(prev).length ? { ...prev, ...nextPositions } : nextPositions);
      rafRef.current = requestAnimationFrame(animate);
    };
    rafRef.current = requestAnimationFrame(animate);
    const onScroll = () => calc();
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    const unsub = editor.on('transaction', () => calc());
    const t = setInterval(calc, 1000);
    return () => {
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
      clearInterval(t);
      (unsub as any)?.();
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [editor, presences]);

  if (!editor) return null;
  return (
    <div ref={containerRef} aria-hidden style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      {Object.entries(positions).map(([uid, p]) => (
        <div key={uid} style={{ position: 'absolute', left: p.left, top: p.top, transform: 'translateY(-1px)' }}>
          {/* selection highlights */}
          {(p.sels || []).map((r, i) => (
            <div key={`sel-${i}`} style={{ position: 'absolute', left: (r.left - p.left), top: (r.top - p.top), width: r.width, height: r.height, background: p.color, opacity: 0.12, borderRadius: 2 }} />
          ))}
          {/* trail dots */}
          {!compact && (trails.current[uid] || []).map((pt, i, arr) => {
            const alpha = (i + 1) / arr.length;
            return (
              <div key={i} style={{ position: 'absolute', left: pt.left - p.left, top: pt.top - p.top }}>
                <div style={{ width: 3, height: 3, borderRadius: 3, background: p.color, opacity: alpha * 0.35 }} />
              </div>
            );
          })}
          {/* caret */}
          <div
            className="remote-caret"
            style={{
              width: 2,
              height: 18,
              background: p.color,
              borderRadius: 1,
              boxShadow: `0 0 0 1px var(--presence-outline)`,
              animation: p.typing ? 'pulse 0.9s ease-in-out infinite' : 'none',
            }}
          />
          {/* label with avatar dot */}
          <div
            className="remote-label"
            style={{
              position: 'absolute',
              top: -22,
              left: 2,
              fontSize: 10,
              padding: '1px 6px 1px 2px',
              borderRadius: 8,
              color: '#111',
              background: 'var(--presence-label-bg)',
              border: `1px solid ${p.color}`,
              opacity: p.idle ? 0.6 : 1,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <span style={{ width: 10, height: 10, borderRadius: 10, background: p.color, display: 'inline-block' }} />
            {p.label}
          </div>
        </div>
      ))}
      {/* injected keyframes for pulse */}
      <style>{`@keyframes pulse{0%{transform:scaleY(1)}50%{transform:scaleY(0.85)}100%{transform:scaleY(1)}}`}</style>
    </div>
  );
}

function safeCoords(editor: Editor, pos: number) {
  try {
    const c = editor.view.coordsAtPos(Math.max(1, Math.min(pos, editor.state.doc.content.size)));
    return c;
  } catch {
    return null;
  }
}
function selectionRects(editor: Editor, a: number, h: number, editorBox: DOMRect) {
  const from = Math.min(a | 0, h | 0);
  const to = Math.max(a | 0, h | 0);
  if (from === to) return [] as { left: number; top: number; width: number; height: number }[];
  try {
    // Try DOM range for accurate multi-line rects
    const v = editor.view as any;
    const start = v.domAtPos(from);
    const end = v.domAtPos(to);
    const range = document.createRange();
    // map to text nodes when possible
    const startNode = nodeFromDomAtPos(start);
    const endNode = nodeFromDomAtPos(end);
    if (!startNode || !endNode) throw new Error('no nodes');
    range.setStart(startNode.node, startNode.offset);
    range.setEnd(endNode.node, endNode.offset);
    const rects: { left: number; top: number; width: number; height: number }[] = [];
    const list = Array.from(range.getClientRects());
    for (const r of list) rects.push({ left: r.left - editorBox.left, top: r.top - editorBox.top, width: r.width, height: r.height });
    return rects.slice(0, 20);
  } catch {
    // Fallback: single rect from coords
    try {
      const c1 = editor.view.coordsAtPos(from);
      const c2 = editor.view.coordsAtPos(to);
      const l = Math.min(c1.left, c2.left) - editorBox.left;
      const t = Math.min(c1.top, c2.top) - editorBox.top;
      const w = Math.abs(c2.left - c1.left);
      const hgt = Math.max(c1.bottom, c2.bottom) - Math.min(c1.top, c2.top);
      return [{ left: l, top: t, width: Math.max(2, w), height: Math.max(12, hgt) }];
    } catch {
      return [];
    }
  }
}
function nodeFromDomAtPos(res: { node: Node; offset: number }) {
  const { node, offset } = res;
  if (node.nodeType === 3) return { node, offset };
  const el = node as Element;
  // choose a child text node if available
  const child = el.childNodes[Math.min(offset, el.childNodes.length - 1)];
  if (!child) return { node: el, offset: Math.min(offset, el.childNodes.length) };
  if (child.nodeType === 3) return { node: child, offset: Math.min((child as any).length || 0, 0) };
  return { node: el, offset };
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
