"use client";
import { useEffect, useRef, useState } from 'react';

type Item = { id: string; label: string; action: () => void };

export function SlashMenu({ items, onClose }: { items: Item[]; onClose: () => void }) {
  const [idx, setIdx] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') return onClose();
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setIdx((v) => (v + 1) % items.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setIdx((v) => (v - 1 + items.length) % items.length);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        items[idx]?.action();
        onClose();
      }
    };
    el?.addEventListener('keydown', onKey);
    return () => el?.removeEventListener('keydown', onKey);
  }, [idx, items, onClose]);

  return (
    <div className="slash-menu" ref={ref} role="listbox" tabIndex={0} aria-label="Insert block">
      {items.map((it, i) => (
        <div key={it.id} role="option" aria-selected={i === idx}>
          {it.label}
        </div>
      ))}
    </div>
  );
}

