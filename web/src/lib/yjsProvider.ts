"use client";
import * as Y from 'yjs';
import { io, Socket } from 'socket.io-client';
import { unzipSync, strToU8, decompressSync } from 'fflate';
import { IndexeddbPersistence } from 'y-indexeddb';

export type YProviderOptions = {
  docId: string;
  apiBase?: string;
  batchMs?: number;
  ttlMs?: number; // cache freshness TTL
  maxBackoffMs?: number;
};

export type SyncStatus =
  | {
      state: 'idle' | 'syncing' | 'ok';
      pending: number;
      lastSyncAt?: number;
      offline: boolean;
      readOnly?: boolean;
      lastError?: { code?: number; type: string; at: number };
    }
  | { state: 'backoff'; pending: number; delayMs: number; offline: boolean; readOnly?: boolean; lastError?: { code?: number; type: string; at: number } };

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
  private readOnly = false;
  private listeners: Set<(s: SyncStatus) => void> = new Set();
  private bc?: BroadcastChannel;
  private socket?: Socket;
  private wsSeq = 0;
  private wsConnected = false;
  private wsQueue: { b64: string; msgId: string; seq: number }[] = [];
  private consecutiveFailures = 0;

  constructor(opts: YProviderOptions) {
    this.ydoc = new Y.Doc();
    this.docId = opts.docId;
    this.apiBase = opts.apiBase || (process.env.NEXT_PUBLIC_API_URL || '');
    this.batchMs = opts.batchMs ?? 500;
    this.maxBackoffMs = opts.maxBackoffMs ?? 30000;
    this.persistence = new IndexeddbPersistence(`doc-${this.docId}`, this.ydoc);
    this.ydoc.on('update', (u: Uint8Array) => {
      // If WS connected, prefer realtime update; otherwise queue for REST flush
      if (this.wsConnected) {
        try {
          const b64 = toBase64(u);
          this.sendYUpdate(b64);
        } catch {
          this.enqueue(u);
        }
      } else {
        this.enqueue(u);
      }
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
    // Attempt realtime WS connection in browser
    if (typeof window !== 'undefined') this.initRealtime();
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
        this.readOnly = false;
        this.consecutiveFailures = 0;
      }
    } catch (e) {
      // offline: rely on IndexedDB to populate state
      // eslint-disable-next-line no-console
      console.warn('Y load failed, using local cache', e);
    }
    await this.persistence.whenSynced; // ensure local cache applied
  }

  // Realtime WebSocket integration
  private initRealtime() {
    const base = this.apiBase || window.location.origin;
    const token = (typeof localStorage !== 'undefined' && localStorage.getItem('accessToken')) || '';
    try {
      this.socket = io(base, {
        transports: ['websocket'],
        withCredentials: true,
        auth: token ? { token: `Bearer ${token}` } : undefined,
      });
    } catch (e) {
      return; // silently fall back to REST-only mode
    }
    const s = this.socket;
    s.on('connect', () => {
      this.wsConnected = true;
      s.emit('doc:join', { documentId: this.docId });
    });
    s.on('disconnect', () => {
      this.wsConnected = false;
      // trigger backoff-based REST flush path to keep data moving
      this.scheduleBackoff('network_error');
    });
    s.on('doc:joined', () => {
      // Drain any queued updates
      const q = [...this.wsQueue];
      this.wsQueue = [];
      q.forEach((m) => this.sendYUpdate(m.b64, m.msgId, m.seq));
    });
    s.on('y-init', (p: { documentId: string; updateB64: string; vectorB64: string; gz?: boolean }) => {
      try {
        const buf = fromBase64(p.updateB64);
        const raw = p.gz ? (decompressSync as any)(buf) : buf;
        Y.applyUpdate(this.ydoc, raw);
        this.markSynced();
      } catch {}
    });
    s.on('y-update', (p: { documentId: string; updateB64: string; gz?: boolean }) => {
      try {
        const buf = fromBase64(p.updateB64);
        const raw = p.gz ? (decompressSync as any)(buf) : buf;
        Y.applyUpdate(this.ydoc, raw);
        this.markSynced();
      } catch {}
    });
    s.on('presence', (p: any) => {
      try {
        window.dispatchEvent(new CustomEvent('doc-presence', { detail: { docId: this.docId, presence: p } }));
      } catch {}
    });
    s.on('ack', (_p: any) => {
      // acks are handled best-effort; no specific action required here
    });
  }

  private sendYUpdate(b64: string, msgId?: string, seq?: number) {
    if (!this.socket || !this.wsConnected) {
      const id = msgId || Math.random().toString(36).slice(2);
      const s = seq || ++this.wsSeq;
      this.wsQueue.push({ b64, msgId: id, seq: s });
      return;
    }
    const id = msgId || Math.random().toString(36).slice(2);
    const s = seq || ++this.wsSeq;
    this.socket.emit('y-update', { documentId: this.docId, updateB64: b64, msgId: id, seq: s });
  }

  sendPresence(p: { anchor: number; head: number; typing?: boolean }) {
    try {
      this.socket?.emit('presence', { documentId: this.docId, ...p });
    } catch {}
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
      const res = await fetch(`${this.apiBase}/api/docs/${this.docId}/y`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw res;
      this.lastSyncAt = Date.now();
      this.backoffMs = 0;
      this.consecutiveFailures = 0;
      this.persistQueue();
      this.saveMeta();
      this.emit('ok');
      this.bumpCounter('sync_ok');
    } catch (e: any) {
      // classify error
      const code = typeof e?.status === 'number' ? e.status : undefined;
      const type = !navigator.onLine
        ? 'offline'
        : code === 401
        ? 'unauthorized'
        : code === 429
        ? 'rate_limit'
        : code && code >= 500
        ? 'server_error'
        : 'network_error';
      this.consecutiveFailures++;
      // queue again on failure (offline/degraded)
      this.enqueue(merged);
      if (type === 'unauthorized') this.readOnly = true;
      this.scheduleBackoff(type, e?.headers);
      this.emitError({ code, type });
      this.bumpCounter('sync_fail');
    }
  }

  private scheduleBackoff(reason?: string, headers?: Headers) {
    const jitter = Math.floor(Math.random() * 300);
    if (reason === 'rate_limit') {
      const ra = headers?.get?.('Retry-After');
      const wait = ra ? parseInt(ra, 10) * 1000 : 2000;
      this.backoffMs = wait + jitter;
    } else if (this.backoffMs === 0) this.backoffMs = 1000 + jitter;
    else this.backoffMs = Math.min(this.backoffMs * 2 + jitter, this.maxBackoffMs);
    setTimeout(() => this.flush().catch(() => {}), this.backoffMs);
    this.emit('backoff');
  }

  onStatus(listener: (s: SyncStatus) => void) {
    this.listeners.add(listener);
    listener(this.status());
    return () => this.listeners.delete(listener);
  }
  status(): SyncStatus {
    const base = { readOnly: this.readOnly, lastError: this.loadLastError() } as any;
    if (this.backoffMs > 0)
      return { state: 'backoff', pending: this.queue.length, delayMs: this.backoffMs, offline: this.offline, ...base };
    return { state: 'idle', pending: this.queue.length, lastSyncAt: this.lastSyncAt, offline: this.offline, ...base };
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
    if (!v) {
      // back online: try partial resync then flush queued updates
      this.resync().finally(() => this.flush().catch(() => {}));
    }
    this.emit();
  }

  async resync() {
    try {
      const res = await fetch(`${this.apiBase}/api/docs/${this.docId}/y`, { credentials: 'include' });
      if (res.ok) {
        const json = await res.json();
        const update = fromBase64(json.update);
        Y.applyUpdate(this.ydoc, update);
        this.markSynced();
        this.readOnly = false;
        this.consecutiveFailures = 0;
      }
    } catch {}
  }

  retryNow() {
    this.backoffMs = 0;
    this.flush().catch(() => {});
  }

  private emitError(err: { code?: number; type: string }) {
    try {
      const detail = { docId: this.docId, at: Date.now(), ...err };
      localStorage.setItem(`doc-last-error:${this.docId}`, JSON.stringify(detail));
      window.dispatchEvent(new CustomEvent('doc-sync-error', { detail }));
    } catch {}
  }
  private loadLastError(): { code?: number; type: string; at: number } | undefined {
    try {
      const raw = localStorage.getItem(`doc-last-error:${this.docId}`);
      return raw ? (JSON.parse(raw) as any) : undefined;
    } catch {
      return undefined;
    }
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
