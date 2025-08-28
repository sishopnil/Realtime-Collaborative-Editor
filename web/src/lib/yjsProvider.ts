"use client";
import * as Y from 'yjs';
import { IndexeddbPersistence } from 'y-indexeddb';

export type YProviderOptions = {
  docId: string;
  apiBase?: string;
  batchMs?: number;
  ttlMs?: number; // cache freshness TTL
  maxBackoffMs?: number;
};

export type SyncStatus =
  | { state: 'idle' | 'syncing' | 'ok'; pending: number; lastSyncAt?: number; offline: boolean }
  | { state: 'backoff'; pending: number; delayMs: number; offline: boolean };

export class SimpleYProvider {
  readonly ydoc: Y.Doc;
  readonly persistence: IndexeddbPersistence;
  private queue: Uint8Array[] = [];
  private timer: any = null;
  private readonly apiBase: string;
  private readonly batchMs: number;
  private readonly docId: string;
  private lastSyncAt?: number;
  private backoffMs = 0;
  private readonly maxBackoffMs: number;
  private offline = false;
  private listeners: Set<(s: SyncStatus) => void> = new Set();
  private bc?: BroadcastChannel;

  constructor(opts: YProviderOptions) {
    this.ydoc = new Y.Doc();
    this.docId = opts.docId;
    this.apiBase = opts.apiBase || (process.env.NEXT_PUBLIC_API_URL || '');
    this.batchMs = opts.batchMs ?? 500;
    this.maxBackoffMs = opts.maxBackoffMs ?? 30000;
    this.persistence = new IndexeddbPersistence(`doc-${this.docId}`, this.ydoc);
    this.ydoc.on('update', (u: Uint8Array) => {
      this.enqueue(u);
      try {
        this.bc?.postMessage({ t: 'u', u: toBase64(u) });
      } catch {}
    });
    this.restoreQueue();
    if (typeof window !== 'undefined') {
      this.offline = !window.navigator.onLine;
      window.addEventListener('online', () => this.setOffline(false));
      window.addEventListener('offline', () => this.setOffline(true));
      this.bc = new BroadcastChannel(`doc-${this.docId}`);
      this.bc.onmessage = (ev) => {
        if (ev.data?.t === 'u') {
          try {
            const u = fromBase64(ev.data.u);
            Y.applyUpdate(this.ydoc, u);
          } catch {}
        }
      };
    }
  }

  async load() {
    try {
      // TTL-based cache freshness
      const ttlMs = this.getTtlMs();
      const meta = this.loadMeta();
      if (ttlMs && meta?.lastSyncAt && Date.now() - meta.lastSyncAt > ttlMs) {
        await this.clearPersistence();
      }
      const res = await fetch(`${this.apiBase}/api/docs/${this.docId}/y`, { credentials: 'include' });
      if (res.ok) {
        const json = await res.json();
        const update = fromBase64(json.update);
        Y.applyUpdate(this.ydoc, update);
        this.markSynced();
      }
    } catch (e) {
      // offline: rely on IndexedDB to populate state
      // eslint-disable-next-line no-console
      console.warn('Y load failed, using local cache', e);
    }
    await this.persistence.whenSynced; // ensure local cache applied
  }

  private enqueue(update: Uint8Array) {
    this.queue.push(update);
    if (this.timer) return;
    this.timer = setTimeout(() => this.flush().catch(() => {}), this.batchMs);
    this.persistQueue();
    this.emit();
    this.bumpCounter('edits');
  }

  async flush() {
    clearTimeout(this.timer);
    this.timer = null;
    if (this.queue.length === 0) return;
    // merge queued updates into a temp doc to minimize payload
    const temp = new Y.Doc();
    for (const u of this.queue) Y.applyUpdate(temp, u);
    this.queue = [];
    const merged = Y.encodeStateAsUpdate(temp);
    const body = { update: toBase64(merged) };
    try {
      this.emit('syncing');
      await fetch(`${this.apiBase}/api/docs/${this.docId}/y`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      this.lastSyncAt = Date.now();
      this.backoffMs = 0;
      this.persistQueue();
      this.saveMeta();
      this.emit('ok');
      this.bumpCounter('sync_ok');
    } catch (e) {
      // queue again on failure (offline)
      this.enqueue(merged);
      this.scheduleBackoff();
      this.bumpCounter('sync_fail');
    }
  }

  private scheduleBackoff() {
    if (this.backoffMs === 0) this.backoffMs = 1000;
    else this.backoffMs = Math.min(this.backoffMs * 2, this.maxBackoffMs);
    setTimeout(() => this.flush().catch(() => {}), this.backoffMs);
    this.emit('backoff');
  }

  onStatus(listener: (s: SyncStatus) => void) {
    this.listeners.add(listener);
    listener(this.status());
    return () => this.listeners.delete(listener);
  }
  status(): SyncStatus {
    if (this.backoffMs > 0) return { state: 'backoff', pending: this.queue.length, delayMs: this.backoffMs, offline: this.offline };
    return { state: 'idle', pending: this.queue.length, lastSyncAt: this.lastSyncAt, offline: this.offline };
  }
  private emit(state?: 'syncing' | 'ok' | 'backoff') {
    const base = this.status();
    const s: SyncStatus =
      state === 'syncing'
        ? { state: 'syncing', pending: base.pending, offline: base.offline, lastSyncAt: this.lastSyncAt }
        : state === 'ok'
        ? { state: 'ok', pending: base.pending, offline: base.offline, lastSyncAt: this.lastSyncAt }
        : base;
    for (const cb of this.listeners) cb(s);
    try {
      window.dispatchEvent(new CustomEvent('doc-sync-status', { detail: { docId: this.docId, status: s } }));
    } catch {}
  }

  private setOffline(v: boolean) {
    this.offline = v;
    if (!v) this.flush().catch(() => {});
    this.emit();
  }

  private metaKey() {
    return `doc-meta:${this.docId}`;
  }
  private queueKey() {
    return `doc-queue:${this.docId}`;
  }
  private loadMeta(): { lastSyncAt?: number } | null {
    try {
      const raw = localStorage.getItem(this.metaKey());
      return raw ? (JSON.parse(raw) as any) : null;
    } catch {
      return null;
    }
  }
  private saveMeta() {
    try {
      localStorage.setItem(this.metaKey(), JSON.stringify({ lastSyncAt: this.lastSyncAt || Date.now(), at: Date.now() }));
    } catch {}
  }
  private markSynced() {
    this.lastSyncAt = Date.now();
    this.saveMeta();
  }
  private getTtlMs(): number | undefined {
    const raw = (process as any).env.NEXT_PUBLIC_DOC_TTL_MS || undefined;
    return raw ? parseInt(String(raw), 10) : undefined;
  }
  private persistQueue() {
    try {
      const arr = this.queue.map((u) => toBase64(u));
      localStorage.setItem(this.queueKey(), JSON.stringify(arr));
    } catch {}
  }
  private restoreQueue() {
    try {
      const raw = localStorage.getItem(this.queueKey());
      if (!raw) return;
      const arr: string[] = JSON.parse(raw);
      for (const b64 of arr) this.queue.push(fromBase64(b64));
      this.emit();
    } catch {}
  }
  async clearPersistence() {
    try {
      // y-indexeddb uses database name `doc-${docId}` by default (we passed in constructor)
      indexedDB.deleteDatabase(`doc-${this.docId}`);
    } catch {}
  }

  private bumpCounter(name: 'edits' | 'sync_ok' | 'sync_fail') {
    try {
      const key = `doc-analytics:${this.docId}`;
      const obj = JSON.parse(localStorage.getItem(key) || '{}');
      obj[name] = (obj[name] || 0) + 1;
      obj.updatedAt = Date.now();
      localStorage.setItem(key, JSON.stringify(obj));
    } catch {}
  }
}

export function toBase64(u8: Uint8Array): string {
  return btoa(String.fromCharCode(...Array.from(u8)));
}

// Quota management: cleanup old cached docs using localStorage metadata
export async function cleanupLocalDocCaches(opts: { maxEntries?: number; olderThanMs?: number } = {}) {
  const max = opts.maxEntries ?? 50;
  const older = opts.olderThanMs ?? 30 * 24 * 60 * 60 * 1000; // 30d
  const metas: { key: string; id: string; last: number }[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i)!;
    if (!k.startsWith('doc-meta:')) continue;
    try {
      const v = JSON.parse(localStorage.getItem(k) || '{}');
      const id = k.slice('doc-meta:'.length);
      metas.push({ key: k, id, last: v.lastSyncAt || v.at || 0 });
    } catch {}
  }
  metas.sort((a, b) => b.last - a.last);
  const toDelete: { key: string; id: string }[] = [];
  for (let idx = 0; idx < metas.length; idx++) {
    const m = metas[idx];
    if (idx >= max || Date.now() - m.last > older) toDelete.push({ key: m.key, id: m.id });
  }
  for (const d of toDelete) {
    try {
      localStorage.removeItem(`doc-meta:${d.id}`);
      localStorage.removeItem(`doc-queue:${d.id}`);
      indexedDB.deleteDatabase(`doc-${d.id}`);
    } catch {}
  }
}
export function fromBase64(b64: string): Uint8Array {
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}
