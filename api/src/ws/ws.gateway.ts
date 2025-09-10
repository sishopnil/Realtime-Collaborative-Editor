import {
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  WsException,
} from '@nestjs/websockets';
import { Socket, Server } from 'socket.io';
import { JwtPayload, verify as jwtVerify } from 'jsonwebtoken';
import { RedisService } from '../redis/redis.service';
import { SecurityLogger } from '../common/security-logger.service';
import { allowWsMessage } from '../common/ws-rate';
import { sanitizeHtml, stripHtml } from '../common/sanitize';
import { DocumentRepository } from '../database/repositories/document.repo';
import { DocumentPermissionRepository } from '../database/repositories/document-permission.repo';
import { WorkspaceMemberRepository } from '../database/repositories/workspace-member.repo';
import { DocumentsService } from '../documents/documents.service';
import { Logger, OnModuleDestroy } from '@nestjs/common';
import { JoinRoomPayload, YUpdatePayload, TextMessagePayload, ClientUser, PresencePayload } from './types';
import * as Y from 'yjs';
import { gzipSync, gunzipSync } from 'zlib';
import { YSyncPayload } from './types';
import * as crypto from 'crypto';

type SocketWithUser = Socket & { data: { user?: ClientUser; joinedDocs?: Set<string> } };

const ROOM_PREFIX = 'doc:';
const MAX_ROOM_CAPACITY = parseInt(process.env.WS_ROOM_CAPACITY || '100', 10);
const BATCH_MS = parseInt(process.env.WS_BATCH_MS || '40', 10);
const COMPRESS_THRESHOLD = parseInt(process.env.WS_COMPRESS_THRESHOLD || '2048', 10);
const UPDATE_MAX_BYTES = parseInt(process.env.WS_UPDATE_MAX_BYTES || '1048576', 10);
const IDLE_PRUNE_MS = parseInt(process.env.WS_IDLE_PRUNE_MS || '300000', 10);
const PRESENCE_MIN_MS = parseInt(process.env.WS_PRESENCE_MIN_MS || '60', 10);
const PRESENCE_TTL_SEC = parseInt(process.env.WS_PRESENCE_TTL_SEC || '60', 10);

@WebSocketGateway({
  cors: {
    origin: (origin, cb) => {
      const allow = (process.env.CORS_ORIGIN || 'http://localhost:3000')
        .split(',')
        .map((o) => o.trim());
      if (!origin || allow.includes(origin)) return cb(null, true);
      return cb(new Error('Origin not allowed by CORS'), false);
    },
    credentials: true,
  },
})
export class WsGateway implements OnGatewayConnection, OnGatewayDisconnect, OnModuleDestroy {
  private server!: Server;
  private logger = new Logger('WsGateway');
  private batches = new Map<string, { updates: Buffer[]; timer?: NodeJS.Timeout; last: number }>();
  private pruneTimer?: NodeJS.Timeout;
  private instanceId = (crypto as any).randomUUID ? (crypto as any).randomUUID() : Math.random().toString(36).slice(2);
  private pub?: any;
  private sub?: any;
  private subRefs = new Map<string, number>();
  private heartbeatTimer?: NodeJS.Timeout;
  private presenceLast = new Map<string, number>(); // key: `${docId}:${userId}`
  private claimPrefix = 'ws:section';

  constructor(
    private readonly redis: RedisService,
    private readonly audit: SecurityLogger,
    private readonly docsRepo: DocumentRepository,
    private readonly permsRepo: DocumentPermissionRepository,
    private readonly membersRepo: WorkspaceMemberRepository,
    private readonly docsService: DocumentsService,
  ) {}

  afterInit(server: Server) {
    this.server = server;
    this.pruneTimer = setInterval(() => this.pruneIdle(), Math.min(IDLE_PRUNE_MS, 60000));
    // Redis pub/sub setup for inter-instance broadcasting
    const base = this.redis.getClient();
    try {
      this.pub = base.duplicate();
      this.sub = base.duplicate();
      this.bindPubSubEvents();
      try { this.sub.subscribe('ws:notify'); } catch {}
    } catch (e) {
      this.logger.warn(`Failed to init pub/sub: ${String(e)}`);
    }
    this.registerInstance();
  }

  async onModuleDestroy() {
    try {
      if (this.pruneTimer) clearInterval(this.pruneTimer);
      if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
      await this.redis.getClient().srem('ws:instances', this.instanceId);
    } catch {}
    try { await this.pub?.quit(); } catch {}
    try { await this.sub?.quit(); } catch {}
  }

  async handleConnection(client: SocketWithUser) {
    try {
      const origin = client.handshake.headers.origin as string | undefined;
      const token =
        (client.handshake.auth && (client.handshake.auth as any).token) ||
        (client.handshake.query && (client.handshake.query as any).token) ||
        (client.handshake.headers.authorization as string | undefined)?.replace('Bearer ', '');

      if (!token) throw new WsException('Missing token');
      const payload = jwtVerify(token, process.env.JWT_SECRET || 'changeme') as JwtPayload & { sub: string; email: string };
      // basic origin validation already handled by CORS; double-check here
      const allow = (process.env.CORS_ORIGIN || 'http://localhost:3000')
        .split(',')
        .map((o) => o.trim());
      if (origin && !allow.includes(origin)) throw new WsException('Origin not allowed');

      // attach user onto socket
      client.data.user = { id: String(payload.sub), email: String(payload.email || '') };
      try { client.join(`user:${client.data.user.id}`); } catch {}

      await this.audit.log('ws.connect', { userId: client.data.user.id, ip: client.handshake.address, origin });
      await this.redis.getClient().incr('ws:connections:total');
    } catch (e: any) {
      await this.audit.log('ws.connect.denied', { reason: e?.message || 'unknown', ip: client.handshake.address });
      this.logger.warn(`WS connection denied: ${e?.message || e}`);
      client.disconnect(true);
    }
  }

  async handleDisconnect(client: SocketWithUser) {
    try {
      await this.audit.log('ws.disconnect', { userId: client.data.user?.id });
      // cleanup online and presence state for joined docs
      const userId = client.data.user?.id;
      if (userId && client.data.joinedDocs && client.data.joinedDocs.size > 0) {
        const r = this.redis.getClient();
        for (const docId of client.data.joinedDocs) {
          try {
            await r.srem(`ws:online:doc:${docId}`, userId);
            await r.srem(`ws:presence:doc:${docId}:users`, userId);
            await r.del(`ws:presence:doc:${docId}:${userId}`);
          } catch {}
        }
      }
    } catch {}
  }

  @SubscribeMessage('doc:join')
  async onJoin(@ConnectedSocket() client: SocketWithUser, @MessageBody() payload: JoinRoomPayload) {
    const user = client.data.user;
    if (!user) throw new WsException('Not authenticated');
    const documentId = (payload && payload.documentId || '').trim();
    if (!documentId) throw new WsException('documentId required');

    const doc = await this.docsRepo.findById(documentId);
    if (!doc) throw new WsException('Document not found');

    const ok = await this.hasDocAccess(user.id, documentId, 'viewer', doc as any);
    if (!ok) {
      await this.audit.log('ws.room.denied', { userId: user.id, documentId });
      throw new WsException('Forbidden');
    }

    // capacity check
    const room = `${ROOM_PREFIX}${documentId}`;
    const size = this.server.sockets.adapter.rooms.get(room)?.size || 0;
    if (size >= MAX_ROOM_CAPACITY) {
      await this.audit.log('ws.room.capacity', { documentId, size });
      throw new WsException('Room capacity reached');
    }

    await client.join(room);
    client.data.joinedDocs = client.data.joinedDocs || new Set<string>();
    client.data.joinedDocs.add(documentId);
    // mark online
    try {
      await this.redis.getClient().sadd(`ws:online:doc:${documentId}`, user.id);
      await this.redis.getClient().expire(`ws:online:doc:${documentId}`, 3600);
    } catch {}
    await this.audit.log('ws.room.join', { userId: user.id, documentId });
    client.emit('doc:joined', { documentId });

    // Send current presence list snapshot
    try {
      const r = this.redis.getClient();
      const ukey = `ws:presence:doc:${documentId}:users`;
      const users = await r.smembers(ukey);
      const list: any[] = [];
      for (const uid of users || []) {
        try {
          const raw = await r.get(`ws:presence:doc:${documentId}:${uid}`);
          if (!raw) continue;
          const p = JSON.parse(raw);
          list.push(p);
        } catch {}
      }
      if (list.length > 0) client.emit('presence:list', { documentId, list });
    } catch {}

    // Notify size warnings if any
    try {
      const note = await this.redis.getClient().get(`doc:size:${documentId}`);
      if (note) client.emit('doc:notice', { documentId, type: 'size', data: JSON.parse(note) });
    } catch {}

    // Flush any offline queued messages for this user+doc
    await this.flushOfflineQueue(documentId, user.id, client);

    // Send initial Yjs state (update + vector)
    try {
      const state = await this.docsService.getYState(documentId);
      const raw = Buffer.from(state.update, 'base64');
      const compressed = this.maybeGzip(raw);
      client.emit('y-init', {
        documentId,
        updateB64: compressed.b64,
        vectorB64: state.vector,
        gz: compressed.gz,
      });
    } catch (e) {
      this.logger.warn(`y-init failed: ${String(e)}`);
    }

    // Send current section claims snapshot
    try {
      const r = this.redis.getClient();
      const setKey = `${this.claimPrefix}:doc:${documentId}`;
      const keys = await r.smembers(setKey);
      const claims: any[] = [];
      for (const k of keys || []) {
        try {
          const raw = await r.get(k);
          if (raw) claims.push(JSON.parse(raw));
        } catch {}
      }
      if (claims.length) client.emit('section:list', { documentId, claims });
    } catch {}

    // Subscribe to inter-instance channel for this document
    await this.subscribeDocChannel(documentId);
  }

  @SubscribeMessage('doc:leave')
  async onLeave(@ConnectedSocket() client: SocketWithUser, @MessageBody() payload: JoinRoomPayload) {
    const user = client.data.user;
    if (!user) throw new WsException('Not authenticated');
    const documentId = (payload && payload.documentId || '').trim();
    const room = `${ROOM_PREFIX}${documentId}`;
    await client.leave(room);
    await this.audit.log('ws.room.leave', { userId: user.id, documentId });
    client.data.joinedDocs?.delete(documentId);
    try {
      // naive: mark offline on leave (does not dedupe multiple tabs)
      await this.redis.getClient().srem(`ws:online:doc:${documentId}`, user.id);
      await this.redis.getClient().srem(`ws:presence:doc:${documentId}:users`, user.id);
      await this.redis.getClient().del(`ws:presence:doc:${documentId}:${user.id}`);
    } catch {}
    client.emit('doc:left', { documentId });
    await this.unsubscribeDocChannel(documentId);
  }

  // Yjs update relay with rate limiting, dedup, ordering, and ack (batched persistence/broadcast)
  @SubscribeMessage('y-update')
  async onYUpdate(@ConnectedSocket() client: SocketWithUser, @MessageBody() payload: YUpdatePayload) {
    const user = client.data.user;
    if (!user) throw new WsException('Not authenticated');

    // rate limit
    const allowed = await allowWsMessage(this.redis, `user:${user.id}`);
    if (!allowed) {
      await this.audit.log('abuse.ws.rate', { userId: user.id });
      throw new WsException('Rate limit exceeded');
    }

    const documentId = (payload && payload.documentId || '').trim();
    const updateB64 = (payload && payload.updateB64 || '').trim();
    if (!documentId || !updateB64) throw new WsException('Invalid payload');
    if (!client.data.joinedDocs?.has(documentId)) throw new WsException('Not in document room');

    // dedup by msgId if provided
    const msgId = (payload && payload.msgId) || undefined;
    if (msgId) {
      const key = `ws:dedup:${documentId}`;
      const ok = await this.redis.getClient().sadd(key, msgId);
      await this.redis.getClient().expire(key, 60);
      if (ok === 0) return client.emit('ack', { msgId, status: 'duplicate' });
    }

    // Optional ordering check by seq per user
    if (payload?.seq != null) {
      const key = `ws:lastseq:${documentId}:${user.id}`;
      const last = parseInt((await this.redis.getClient().get(key)) || '0', 10);
      if (payload.seq <= last) {
        return client.emit('ack', { msgId, status: 'out_of_order' });
      }
      await this.redis.getClient().set(key, String(payload.seq), 'EX', 300);
    }

    // Decode & validate update size
    const upd = this.decodeUpdate(updateB64);
    if (upd.byteLength > UPDATE_MAX_BYTES) throw new WsException('Update too large');
    try {
      const tmp = new Y.Doc();
      Y.applyUpdate(tmp, upd);
    } catch (e) {
      await this.audit.log('ws.update.invalid', { userId: user.id, documentId });
      throw new WsException('Invalid update');
    }

    // Enqueue for batched apply + broadcast
    this.enqueueUpdate(documentId, upd);
    client.emit('ack', { msgId, status: 'ok' });
  }

  // Simple sanitized text message route (e.g., comments)
  @SubscribeMessage('doc:msg')
  async onTextMsg(@ConnectedSocket() client: SocketWithUser, @MessageBody() payload: TextMessagePayload) {
    const user = client.data.user;
    if (!user) throw new WsException('Not authenticated');
    const allowed = await allowWsMessage(this.redis, `user:${user.id}`);
    if (!allowed) throw new WsException('Rate limit exceeded');

    const documentId = (payload && payload.documentId || '').trim();
    let content = (payload && payload.content || '').slice(0, 2000);
    if (!documentId || !content) throw new WsException('Invalid payload');
    // sanitize content
    content = sanitizeHtml(content) || stripHtml(content) || '';

    const room = `${ROOM_PREFIX}${documentId}`;
    const msg = { documentId, content, from: user.id, ts: Date.now() };
    client.to(room).emit('doc:msg', msg);
    await this.queueForOffline(documentId, 'doc:msg', msg);
    await this.publishFanout(documentId, { type: 'doc:msg', payload: msg });
    // ack if requested
    if (payload?.msgId) client.emit('ack', { msgId: payload.msgId, status: 'ok' });
  }

  // Client requests diff update given optional state vector
  @SubscribeMessage('y-sync')
  async onYSync(@ConnectedSocket() client: SocketWithUser, @MessageBody() payload: YSyncPayload) {
    const user = client.data.user;
    if (!user) throw new WsException('Not authenticated');
    const documentId = (payload && payload.documentId || '').trim();
    if (!documentId) throw new WsException('documentId required');
    try {
      const state = await this.docsService.getYState(documentId);
      const baseDoc = new Y.Doc();
      Y.applyUpdate(baseDoc, Buffer.from(state.update, 'base64'));
      let update: Uint8Array;
      if (payload?.vectorB64) update = Y.encodeStateAsUpdate(baseDoc, Buffer.from(payload.vectorB64, 'base64'));
      else update = Y.encodeStateAsUpdate(baseDoc);
      const compressed = this.maybeGzip(Buffer.from(update));
      client.emit('y-sync', { documentId, updateB64: compressed.b64, gz: compressed.gz, vectorB64: state.vector });
    } catch (e) {
      this.logger.warn(`y-sync failed: ${String(e)}`);
      throw new WsException('Sync failed');
    }
  }

  // Presence (cursor/selection/typing) fanout without persistence
  @SubscribeMessage('presence')
  async onPresence(@ConnectedSocket() client: SocketWithUser, @MessageBody() payload: PresencePayload) {
    const user = client.data.user;
    if (!user) throw new WsException('Not authenticated');
    const allowed = await allowWsMessage(this.redis, `user:${user.id}`);
    if (!allowed) throw new WsException('Rate limit exceeded');
    const documentId = (payload && payload.documentId || '').trim();
    if (!documentId) throw new WsException('documentId required');
    const room = `${ROOM_PREFIX}${documentId}`;
    // throttle presence spam per user/doc
    const k = `${documentId}:${user.id}`;
    const now = Date.now();
    const last = this.presenceLast.get(k) || 0;
    if (now - last < PRESENCE_MIN_MS) {
      try { await this.redis.getClient().incr('metrics:presence:dropped'); } catch {}
      return; // drop silently
    }
    this.presenceLast.set(k, now);
    const evt = { documentId, anchor: payload.anchor|0, head: payload.head|0, typing: !!payload.typing, userId: user.id, ts: Date.now() } as any;

    // Persist to Redis with TTL for aggregation
    try {
      const r = this.redis.getClient();
      await r.sadd(`ws:presence:doc:${documentId}:users`, user.id);
      await r.expire(`ws:presence:doc:${documentId}:users`, Math.max(PRESENCE_TTL_SEC, 10));
      await r.set(`ws:presence:doc:${documentId}:${user.id}`, JSON.stringify(evt), 'EX', Math.max(PRESENCE_TTL_SEC, 10));
    } catch {}
    client.to(room).emit('presence', evt);
    await this.publishFanout(documentId, { type: 'presence', payload: evt });
    try { await this.redis.getClient().incr('metrics:presence:sent'); } catch {}
  }

  // Health/diagnostics
  @SubscribeMessage('ws:ping')
  async onPing(@ConnectedSocket() client: SocketWithUser) {
    try {
      const r = this.redis.getClient();
      const pong = await r.ping();
      client.emit('ws:pong', { ts: Date.now(), redis: pong });
    } catch {
      client.emit('ws:pong', { ts: Date.now(), redis: 'err' });
    }
  }

  // Lightweight metrics collector (best-effort)
  @SubscribeMessage('doc:metric')
  async onMetric(@ConnectedSocket() client: SocketWithUser, @MessageBody() payload: any) {
    const user = client.data.user;
    if (!user) throw new WsException('Not authenticated');
    try {
      const { documentId, name } = payload || {};
      if (!documentId || !name) return;
      const r = this.redis.getClient();
      await r.incr(`metrics:${name}:doc:${documentId}`);
      await r.expire(`metrics:${name}:doc:${documentId}`, 86400);
    } catch {}
  }

  // Section claim: soft-ownership to reduce conflicts
  @SubscribeMessage('section:claim')
  async onSectionClaim(@ConnectedSocket() client: SocketWithUser, @MessageBody() payload: any) {
    const user = client.data.user;
    if (!user) throw new WsException('Not authenticated');
    const documentId = (payload && payload.documentId) || '';
    const from = Math.max(1, (payload && payload.from) | 0);
    const to = Math.max(from, (payload && payload.to) | 0);
    const ttl = Math.min(600, Math.max(10, (payload && payload.ttlSec) | 0 || 60));
    if (!documentId) throw new WsException('documentId required');
    const claimId = (crypto as any).randomUUID ? (crypto as any).randomUUID() : Math.random().toString(36).slice(2);
    const data = { claimId, documentId, from, to, userId: user.id, ts: Date.now(), ttl };
    try {
      const r = this.redis.getClient();
      const key = `${this.claimPrefix}:doc:${documentId}:${claimId}`;
      const setKey = `${this.claimPrefix}:doc:${documentId}`;
      await r.set(key, JSON.stringify(data), 'EX', ttl);
      await r.sadd(setKey, key);
      await r.expire(setKey, Math.max(ttl, 120));
    } catch {}
    const room = `${ROOM_PREFIX}${documentId}`;
    client.to(room).emit('section:claimed', data);
    await this.publishFanout(documentId, { type: 'section:claimed', payload: data });
    client.emit('ack', { msgId: payload?.msgId, status: 'ok', claimId });
  }

  @SubscribeMessage('section:release')
  async onSectionRelease(@ConnectedSocket() client: SocketWithUser, @MessageBody() payload: any) {
    const user = client.data.user;
    if (!user) throw new WsException('Not authenticated');
    const documentId = (payload && payload.documentId) || '';
    const claimId = (payload && payload.claimId) || '';
    if (!documentId || !claimId) throw new WsException('Invalid payload');
    const room = `${ROOM_PREFIX}${documentId}`;
    try {
      const r = this.redis.getClient();
      const key = `${this.claimPrefix}:doc:${documentId}:${claimId}`;
      const raw = await r.get(key);
      if (raw) {
        const data = JSON.parse(raw);
        if (String(data.userId) !== String(user.id)) throw new WsException('Not owner');
      }
      await r.del(key);
      await r.srem(`${this.claimPrefix}:doc:${documentId}`, key);
    } catch {}
    const evt = { claimId, documentId, by: user.id };
    client.to(room).emit('section:released', evt);
    await this.publishFanout(documentId, { type: 'section:released', payload: evt });
    client.emit('ack', { msgId: payload?.msgId, status: 'ok' });
  }

  private async hasDocAccess(userId: string, documentId: string, role: 'viewer' | 'editor' | 'owner', doc?: any) {
    const rank: Record<string, number> = { viewer: 1, editor: 2, owner: 3 };
    const d = doc || (await this.docsRepo.findById(documentId));
    if (!d) return false;
    if (String(d.ownerId) === userId) return true;
    const perm = await this.permsRepo.find(documentId, userId);
    if (perm && rank[(perm as any).role] >= rank[role]) return true;
    const mem = await this.membersRepo.findRole((d as any).workspaceId, userId);
    if (!mem) return false;
    const wsRole = (mem as any).role as string;
    const mapped = wsRole === 'viewer' ? 'viewer' : wsRole === 'editor' ? 'editor' : 'owner';
    return rank[mapped] >= rank[role];
  }

  private async flushOfflineQueue(documentId: string, userId: string, client: Socket) {
    const key = `ws:queue:${documentId}:${userId}`;
    const r = this.redis.getClient();
    try {
      for (let i = 0; i < 1000; i++) {
        const raw = await r.rpop(key);
        if (!raw) break;
        try {
          const evt = JSON.parse(raw);
          client.emit(evt.event, evt.payload);
        } catch {}
      }
    } catch {}
  }

  private async queueForOffline(documentId: string, event: string, payload: any) {
    try {
      const d = await this.docsRepo.findById(documentId);
      if (!d) return;
      const wsId = (d as any).workspaceId as string;
      const perms = await this.permsRepo.list(documentId);
      const members = await this.membersRepo.listMembers(wsId);
      const intended = new Set<string>();
      intended.add(String((d as any).ownerId));
      for (const p of perms as any[]) intended.add(String(p.userId));
      for (const m of members as any[]) intended.add(String(m.userId));
      // remove online users
      let online: string[] = [];
      try {
        online = await this.redis.getClient().smembers(`ws:online:doc:${documentId}`);
      } catch {}
      for (const uid of online) intended.delete(uid);
      // enqueue per offline user
      for (const uid of intended) {
        const key = `ws:queue:${documentId}:${uid}`;
        await this.redis.getClient().lpush(key, JSON.stringify({ event, payload }));
        await this.redis.getClient().ltrim(key, 0, 999); // cap per-user queue to 1000
        await this.redis.getClient().expire(key, 86400);
      }
    } catch {}
  }

  private enqueueUpdate(documentId: string, update: Buffer) {
    const now = Date.now();
    let entry = this.batches.get(documentId);
    if (!entry) {
      entry = { updates: [], last: now };
      this.batches.set(documentId, entry);
    }
    entry.updates.push(update);
    entry.last = now;
    if (!entry.timer) {
      entry.timer = setTimeout(() => this.flushDoc(documentId), BATCH_MS);
    }
  }

  private async flushDoc(documentId: string) {
    const entry = this.batches.get(documentId);
    if (!entry) return;
    const updates = entry.updates;
    entry.updates = [];
    if (entry.timer) clearTimeout(entry.timer);
    entry.timer = undefined;
    if (updates.length === 0) return;
    try {
      const merged = Y.mergeUpdates(updates as any);
      const b64 = Buffer.from(merged).toString('base64');
      await this.docsService.applyYUpdate(documentId, b64);
      const comp = this.maybeGzip(Buffer.from(merged));
      const room = `${ROOM_PREFIX}${documentId}`;
      const evt = { documentId, updateB64: comp.b64, gz: comp.gz } as any;
      this.server.to(room).emit('y-update', evt);
      await this.queueForOffline(documentId, 'y-update', evt);
      await this.publishFanout(documentId, { type: 'y-update', payload: evt });
      try {
        const r = this.redis.getClient();
        const instances = await r.smembers('ws:instances');
        const leader = this.pickLeader(instances, documentId);
        if (!leader || leader === this.instanceId) {
          await r.incr(`metrics:yupdate:${documentId}:count`);
          await r.incrby(`metrics:yupdate:${documentId}:bytes`, Buffer.byteLength(comp.b64, 'utf8'));
        }
      } catch {}
    } catch (e) {
      this.logger.error(`flushDoc failed for ${documentId}: ${String(e)}`);
    }
  }

  private pruneIdle() {
    const now = Date.now();
    for (const [docId, entry] of this.batches) {
      if (now - entry.last > IDLE_PRUNE_MS) this.batches.delete(docId);
    }
  }

  private decodeUpdate(b64: string): Buffer {
    const raw = Buffer.from(b64, 'base64');
    try {
      return gunzipSync(raw);
    } catch {
      return raw;
    }
  }

  private maybeGzip(buf: Buffer): { b64: string; gz: boolean } {
    if (buf.byteLength >= COMPRESS_THRESHOLD) {
      try {
        const gz = gzipSync(buf, { level: 6 });
        return { b64: gz.toString('base64'), gz: true };
      } catch {}
    }
    return { b64: buf.toString('base64'), gz: false };
  }

  // Jump consistent hash for leader selection
  private pickLeader(instances: string[], key: string): string | undefined {
    if (!instances || instances.length === 0) return undefined;
    // Simple stable hash -> index
    let hash = 2166136261;
    for (let i = 0; i < key.length; i++) {
      hash ^= key.charCodeAt(i);
      hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
    }
    const idx = Math.abs(hash) % instances.length;
    return instances[idx];
  }

  private async subscribeDocChannel(documentId: string) {
    if (!this.sub) return;
    const chan = `ws:room:${documentId}`;
    const n = (this.subRefs.get(documentId) || 0) + 1;
    this.subRefs.set(documentId, n);
    if (n === 1) {
      try { await this.sub.subscribe(chan); } catch (e) { this.logger.warn(`subscribe failed ${chan}: ${String(e)}`); }
    }
  }

  private async unsubscribeDocChannel(documentId: string) {
    if (!this.sub) return;
    const chan = `ws:room:${documentId}`;
    const n = (this.subRefs.get(documentId) || 0) - 1;
    if (n <= 0) {
      this.subRefs.delete(documentId);
      try { await this.sub.unsubscribe(chan); } catch {}
    } else {
      this.subRefs.set(documentId, n);
    }
  }

  private bindPubSubEvents() {
    if (!this.sub) return;
    this.sub.on('message', (channel: string, message: string) => {
      try {
        const data = JSON.parse(message) as { origin?: string; type?: string; payload?: any; documentId?: string; to?: string };
        if (data.origin && data.origin === this.instanceId) return;
        if (channel === 'ws:notify') {
          const to = (data as any).to as string | undefined;
          if (to) this.server.to(`user:${to}`).emit('notify', (data as any).payload);
          return;
        }
        const docId = data.payload?.documentId || data.documentId || channel.replace('ws:room:', '');
        const room = `${ROOM_PREFIX}${docId}`;
        if (data.type === 'y-update') {
          this.server.to(room).emit('y-update', data.payload);
        } else if (data.type === 'doc:msg') {
          this.server.to(room).emit('doc:msg', data.payload);
        } else if (data.type === 'presence') {
          this.server.to(room).emit('presence', data.payload);
        } else if (data.type === 'section:claimed') {
          this.server.to(room).emit('section:claimed', data.payload);
        } else if (data.type === 'section:released') {
          this.server.to(room).emit('section:released', data.payload);
        } else if (data.type === 'comment:created') {
          this.server.to(room).emit('comment:created', data.payload);
        } else if (data.type === 'comment:updated') {
          this.server.to(room).emit('comment:updated', data.payload);
        } else if (data.type === 'comment:deleted') {
          this.server.to(room).emit('comment:deleted', data.payload);
        } else if (data.type === 'comment:resolved') {
          this.server.to(room).emit('comment:resolved', data.payload);
        }
      } catch (e) {
        this.logger.warn(`sub message parse failed: ${String(e)}`);
      }
    });
    const onErr = (e: any) => this.logger.warn(`redis pub/sub error: ${String(e)}`);
    this.sub.on('error', onErr);
    this.pub?.on('error', onErr);
  }

  private async publishFanout(documentId: string, msg: { type: string; payload: any }) {
    try {
      if (!this.pub) return;
      const chan = `ws:room:${documentId}`;
      const body = JSON.stringify({ origin: this.instanceId, documentId, ...msg });
      await this.pub.publish(chan, body);
    } catch (e) {
      this.logger.warn(`publish failed: ${String(e)}`);
    }
  }

  private async registerInstance() {
    try {
      const r = this.redis.getClient();
      await r.sadd('ws:instances', this.instanceId);
      await r.hset(`ws:inst:${this.instanceId}`, { startedAt: new Date().toISOString(), pid: String((process as any).pid || 0) } as any);
      const beat = async () => {
        try {
          await r.set(`ws:inst:${this.instanceId}:heartbeat`, String(Date.now()), 'EX', 30);
          const total = (this.server as any)?.engine?.clientsCount || 0;
          await r.set(`ws:inst:${this.instanceId}:clients`, String(total), 'EX', 60);
        } catch {}
      };
      await beat();
      this.heartbeatTimer = setInterval(beat, 10000);
    } catch (e) {
      this.logger.warn(`registerInstance failed: ${String(e)}`);
    }
  }
}
