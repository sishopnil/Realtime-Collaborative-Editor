import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { JobQueueService } from './job-queue.service';
import { DocumentUpdateRepository } from '../database/repositories/document-update.repo';
import { DocumentContentRepository } from '../database/repositories/document-content.repo';
import { SecurityLogger } from '../common/security-logger.service';
import { DocumentsService } from '../documents/documents.service';

@Injectable()
export class DocumentJobsService implements OnModuleInit {
  private readonly logger = new Logger(DocumentJobsService.name);

  constructor(
    private readonly queue: JobQueueService,
    private readonly updates: DocumentUpdateRepository,
    private readonly contents: DocumentContentRepository,
    private readonly audit: SecurityLogger,
    private readonly docsService: DocumentsService,
  ) {}

  onModuleInit() {
    // register processors
    this.queue.register('doc.compact', async (data) => this.processCompact(data.documentId as string));
    this.queue.register('doc.snapshot', async (data) => this.processSnapshot(data.documentId as string));
    this.queue.register('doc.cache.warm', async (data) => this.processCacheWarm(data.documentId as string));
    // periodic scheduling based on activity (latest seq)
    setInterval(async () => {
      try {
        const threshold = parseInt(process.env.DOC_COMPACT_THRESHOLD || '800', 10);
        const hot = await this.updates.hotDocuments(threshold, 50);
        for (const h of hot) {
          await this.enqueueCompaction(h.documentId, 0);
          await this.queue.add('doc.cache.warm', { documentId: h.documentId }, { attempts: 1 });
          // also ensure periodic snapshots for hot docs
          await this.queue.add('doc.snapshot', { documentId: h.documentId }, { attempts: 1 });
        }
      } catch (e) {
        await this.audit.log('jobs.schedule.error', { job: 'doc.compact', err: String(e) });
      }
    }, 60_000);
  }

  async enqueueCompaction(documentId: string, delayMs = 0) {
    await this.queue.add('doc.compact', { documentId }, { delayMs });
  }

  private async processCompact(documentId: string) {
    // Best-effort compaction: keep last N updates (already supported in write-path). This reinforces it.
    const keep = parseInt(process.env.DOC_UPDATE_KEEP || '500', 10);
    // get latest seq so we can compute cutoff
    const latest = await this.updates.latestSeq(documentId);
    const cutoff = latest - keep;
    if (cutoff > 0) await this.updates.compactUpTo(documentId, cutoff);
    await this.audit.log('doc.compact.run', { documentId, latest, cutoff });
    this.logger.log(`Compacted updates for ${documentId} up to seq ${cutoff}`);
  }

  private async processSnapshot(documentId: string) {
    // Rebuild merged snapshot from update log in batches
    const Y = require('yjs');
    const zlib = require('zlib');
    const crypto = require('crypto');
    const ydoc = new Y.Doc();
    let cursor = 0;
    // apply updates in order
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const batch = await this.updates.listAsc(documentId, cursor, 1000);
      if (!batch.length) break;
      for (const u of batch) {
        try {
          const update = zlib.gunzipSync(u.update);
          Y.applyUpdate(ydoc, update);
          cursor = u.seq;
        } catch {}
      }
      if (batch.length < 1000) break;
    }
    const merged: Buffer = Buffer.from(Y.encodeStateAsUpdate(ydoc));
    const vector: Buffer = Buffer.from(Y.encodeStateVector(ydoc));
    const gz: Buffer = zlib.gzipSync(merged);
    const checksum: string = crypto.createHash('sha256').update(merged).digest('hex');
    await this.contents.upsertState(documentId, gz, vector, checksum);
    await this.audit.log('doc.snapshot.regenerated', { documentId, cursor });
  }

  private async processCacheWarm(documentId: string) {
    try {
      await this.docsService.getYState(documentId);
      await this.audit.log('doc.cache.warm', { documentId });
    } catch (e) {
      await this.audit.log('doc.cache.warm.fail', { documentId, err: String(e) });
    }
  }
}
