import { Injectable, NotFoundException, ForbiddenException, ConflictException } from '@nestjs/common';
import { DocumentRepository } from '../database/repositories/document.repo';
import { CreateDocumentDto } from './dto/create-document.dto';
import { UpdateDocumentDto } from './dto/update-document.dto';
import { CacheService } from '../redis/cache.service';
import { WorkspaceRepository } from '../database/repositories/workspace.repo';
import { DocumentPermissionRepository } from '../database/repositories/document-permission.repo';
import { UserRepository } from '../database/repositories/user.repo';
import * as Y from 'yjs';
import { gzipSync, gunzipSync } from 'zlib';
import { DocumentContentRepository } from '../database/repositories/document-content.repo';
import { createHash } from 'crypto';
import { runWithTransaction } from '../database/transaction';
import { LockService } from '../common/lock.service';
import { SecurityLogger } from '../common/security-logger.service';
import { DocumentUpdateRepository } from '../database/repositories/document-update.repo';
import { MemoryCacheService } from '../common/memory-cache.service';
import { DocumentSnapshotRepository } from '../database/repositories/document-snapshot.repo';

@Injectable()
export class DocumentsService {
  constructor(
    private readonly docs: DocumentRepository,
    private readonly cache: CacheService,
    private readonly workspacesRepo: WorkspaceRepository,
    private readonly perms: DocumentPermissionRepository,
    private readonly users: UserRepository,
    private readonly contents: DocumentContentRepository,
    private readonly lock: LockService,
    private readonly audit: SecurityLogger,
    private readonly updates: DocumentUpdateRepository,
    private readonly memCache: MemoryCacheService,
    private readonly snaps: DocumentSnapshotRepository,
  ) {}

  async create(input: CreateDocumentDto) {
    // enforce workspace document limits if configured
    const ws = await this.workspacesRepo.findById(input.workspaceId);
    const maxDocs = (ws as any)?.settings?.resourceLimits?.maxDocuments;
    if (maxDocs) {
      const count = await this.docs.countByWorkspace(input.workspaceId);
      if (count >= maxDocs) throw new ForbiddenException('Workspace document limit reached');
    }
    const doc = await this.docs.create({
      workspaceId: input.workspaceId,
      ownerId: input.ownerId,
      title: input.title,
      status: 'active',
      tags: [],
    });
    await this.cache.del(`docs:ws:${input.workspaceId}`);
    return doc;
  }

  async list(workspaceId: string, opts?: { q?: string; tag?: string }) {
    const key = `docs:ws:${workspaceId}`;
    if (!opts?.q && !opts?.tag) {
      const cached = await this.cache.getJson<any[]>(key);
      if (cached) return cached;
    }
    const list = await this.docs.listByWorkspace(workspaceId, opts);
    if (!opts?.q && !opts?.tag) await this.cache.setJson(key, list, 30);
    return list;
  }

  async update(id: string, input: UpdateDocumentDto) {
    const doc = await this.docs.update(id, input);
    if (!doc) throw new NotFoundException('Document not found');
    await this.cache.del(`docs:ws:${(doc as any).workspaceId}`);
    return doc;
  }

  async softDelete(id: string) {
    const doc = await this.docs.update(id, {
      status: 'deleted' as any,
      deletedAt: new Date() as any,
    });
    if (!doc) throw new NotFoundException('Document not found');
    await this.cache.del(`docs:ws:${(doc as any).workspaceId}`);
    return { ok: true };
  }

  listPermissions(documentId: string) {
    return this.perms.list(documentId);
  }

  async addPermission(
    documentId: string,
    body: { userId?: string; email?: string; role: 'viewer' | 'editor' },
  ) {
    let userId = body.userId;
    if (!userId && body.email) {
      const u = await this.users.findByEmail(body.email.toLowerCase().trim());
      if (!u) throw new NotFoundException('User not found');
      userId = (u as any)._id;
    }
    if (!userId) throw new NotFoundException('User not specified');
    return this.perms.upsert(documentId, userId, body.role);
  }

  removePermission(documentId: string, userId: string) {
    return this.perms.remove(documentId, userId);
  }

  // Yjs state persistence (gzipped base64 update and vector)
  async getYState(documentId: string) {
    const memKey = `doc:y:${documentId}`;
    const cached = this.memCache.get<{ update: string; vector: string }>(memKey);
    if (cached) {
      try { await this.cache.incr('cache:y:mem:hits'); } catch {}
      return cached;
    }
    // redis cache
    const redisKey = `doc:y:${documentId}`;
    const rCached = await this.cache.getJson<{ update: string; vector: string }>(redisKey);
    if (rCached) {
      try { await this.cache.incr('cache:y:redis:hits'); } catch {}
      this.memCache.set(memKey, rCached, parseInt(process.env.MEM_CACHE_Y_TTL || '5', 10));
      return rCached;
    }
    try { await this.cache.incr('cache:y:miss'); } catch {}
    const rec = await this.contents.findByDocumentId(documentId);
    if (!rec) {
      // new empty doc
      const ydoc = new Y.Doc();
      const update = Y.encodeStateAsUpdate(ydoc);
      const vector = Y.encodeStateVector(ydoc);
      const out = { update: Buffer.from(update).toString('base64'), vector: Buffer.from(vector).toString('base64') };
      this.memCache.set(memKey, out, parseInt(process.env.MEM_CACHE_Y_TTL || '5', 10));
      await this.cache.setJson(redisKey, out, parseInt(process.env.REDIS_CACHE_Y_TTL || '30', 10));
      return out;
    }
    // stored gzipped; return raw update base64 for clients
    const raw = gunzipSync(rec.state);
    // optional integrity check
    if (rec.checksum) {
      const sum = createHash('sha256').update(raw).digest('hex');
      if (sum !== rec.checksum) {
        await this.audit.log('doc.integrity.mismatch', { documentId });
      }
    }
    await this.audit.log('doc.state.get', { documentId });
    const out = { update: Buffer.from(raw).toString('base64'), vector: rec.vector.toString('base64') };
    this.memCache.set(memKey, out, parseInt(process.env.MEM_CACHE_Y_TTL || '5', 10));
    await this.cache.setJson(redisKey, out, parseInt(process.env.REDIS_CACHE_Y_TTL || '30', 10));
    return out;
  }

  async applyYUpdate(documentId: string, updateB64: string) {
    const rec = await this.contents.findByDocumentId(documentId);
    const ydoc = new Y.Doc();
    if (rec) {
      try {
        Y.applyUpdate(ydoc, gunzipSync(rec.state));
      } catch {}
    }
    let update: Buffer;
    try {
      update = gunzipSync(Buffer.from(updateB64, 'base64'));
    } catch {
      update = Buffer.from(updateB64, 'base64');
    }
    Y.applyUpdate(ydoc, update);
    const merged = Y.encodeStateAsUpdate(ydoc);
    const vector = Y.encodeStateVector(ydoc);
    const gz = gzipSync(Buffer.from(merged));
    const checksum = createHash('sha256').update(Buffer.from(merged)).digest('hex');

    // Document size limits and alerting
    const maxBytes = parseInt(process.env.DOC_MAX_STATE_BYTES || '6291456', 10); // 6MB default
    const sizeBytes = Buffer.byteLength(merged);
    if (sizeBytes > maxBytes) {
      await this.audit.log('doc.size.limit', { documentId, bytes: sizeBytes });
      await this.cache.setJson(`doc:size:${documentId}`, { level: 'limit', bytes: sizeBytes }, 120);
    } else if (sizeBytes > Math.floor(maxBytes * 0.8)) {
      await this.audit.log('doc.size.warn', { documentId, bytes: sizeBytes });
      await this.cache.setJson(`doc:size:${documentId}`, { level: 'warn', bytes: sizeBytes }, 120);
    } else {
      await this.cache.del(`doc:size:${documentId}`);
    }

    // Acquire a short lock to serialize concurrent writers on same document
    const lockKey = `lock:doc:${documentId}`;
    const token = await this.lock.acquire(lockKey, 5000);
    if (!token) throw new ConflictException('Document is busy, retry');
    try {
      let seq = 0;
      await runWithTransaction(async (session) => {
        // increment version and use it as the sequence for the append-only log
        const v = await this.docs.incVersion(documentId, session);
        seq = (v as any)?.version ?? 0;
        // write log entry first
        await this.updates.append(documentId, seq, gzipSync(update), {
          sizeBytes: update.length,
          session,
        });
        // persist merged snapshot and vector
        await this.contents.upsertState(documentId, gz, Buffer.from(vector), checksum, session);
        // periodic snapshotting for history & recovery
        const takeEvery = parseInt(process.env.DOC_SNAPSHOT_EVERY || '200', 10);
        if (seq % takeEvery === 0) {
          await this.snaps.create(documentId, seq, gz, Buffer.from(vector), checksum, session);
        }
      });
      // opportunistic compaction: keep only the most recent N updates
      const keep = parseInt(process.env.DOC_UPDATE_KEEP || '500', 10);
      if (seq > keep) {
        await this.updates.compactUpTo(documentId, seq - keep);
      }
    } finally {
      await this.lock.release(lockKey, token);
    }

    // Metrics and monitoring
    try {
      const total = await this.updates.countByDocument(documentId);
      if (total > parseInt(process.env.DOC_UPDATE_ALERT_THRESHOLD || '5000', 10)) {
        await this.audit.log('doc.updatelog.threshold', { documentId, total });
      }
      await this.audit.log('doc.update.applied', { documentId, bytes: update.length });
      // Invalidate caches and warm with fresh state
      const memKey = `doc:y:${documentId}`;
      this.memCache.del(memKey);
      await this.cache.del(`doc:y:${documentId}`);
      const out = { update: Buffer.from(merged).toString('base64'), vector: Buffer.from(vector).toString('base64') };
      this.memCache.set(memKey, out, parseInt(process.env.MEM_CACHE_Y_TTL || '5', 10));
      await this.cache.setJson(`doc:y:${documentId}`, out, parseInt(process.env.REDIS_CACHE_Y_TTL || '30', 10));
    } catch {}

    return { ok: true };
  }

  // List last N snapshots
  listSnapshots(documentId: string, limit = 20) {
    return this.snaps.list(documentId, limit);
  }

  // Rollback to a snapshot id
  async rollbackToSnapshot(documentId: string, snapshotId: string) {
    const snap = await this.snaps.findById(snapshotId);
    if (!snap || String((snap as any).documentId) !== String(documentId)) throw new NotFoundException('Snapshot not found');
    await runWithTransaction(async (session) => {
      await this.contents.upsertState(documentId, (snap as any).state, (snap as any).vector, (snap as any).checksum, session);
    });
    // invalidate caches so clients fetch new state
    const memKey = `doc:y:${documentId}`;
    this.memCache.del(memKey);
    await this.cache.del(`doc:y:${documentId}`);
    await this.audit.log('doc.rollback', { documentId, snapshotId });
    return { ok: true };
  }

  // Validate and attempt repair from update log if checksum mismatch or corruption suspected
  async validateAndRepair(documentId: string) {
    const rec = await this.contents.findByDocumentId(documentId);
    if (!rec) return { ok: true, repaired: false, reason: 'no-content' } as any;
    let raw: Buffer;
    try {
      raw = gunzipSync(rec.state);
    } catch {
      raw = Buffer.alloc(0);
    }
    const sum = createHash('sha256').update(raw).digest('hex');
    if ((rec as any).checksum && sum === (rec as any).checksum) return { ok: true, repaired: false } as any;
    // rebuild from update log similar to snapshot job
    const Yjs = require('yjs');
    const zlib = require('zlib');
    const crypto = require('crypto');
    const ydoc = new Yjs.Doc();
    let cursor = 0;
    // stream updates forward
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const batch = await this.updates.listAsc(documentId, cursor, 1000);
      if (!batch.length) break;
      for (const u of batch) {
        try {
          const update = zlib.gunzipSync(u.update);
          Yjs.applyUpdate(ydoc, update);
          cursor = u.seq;
        } catch {}
      }
      if (batch.length < 1000) break;
    }
    const merged: Buffer = Buffer.from(Yjs.encodeStateAsUpdate(ydoc));
    const vector: Buffer = Buffer.from(Yjs.encodeStateVector(ydoc));
    const gz: Buffer = zlib.gzipSync(merged);
    const checksum: string = crypto.createHash('sha256').update(merged).digest('hex');
    await this.contents.upsertState(documentId, gz, vector, checksum);
    await this.audit.log('doc.repair', { documentId, cursor });
    // refresh caches
    const out = { update: merged.toString('base64'), vector: vector.toString('base64') };
    this.memCache.set(`doc:y:${documentId}`, out, parseInt(process.env.MEM_CACHE_Y_TTL || '5', 10));
    await this.cache.setJson(`doc:y:${documentId}`, out, parseInt(process.env.REDIS_CACHE_Y_TTL || '30', 10));
    return { ok: true, repaired: true };
  }
}
