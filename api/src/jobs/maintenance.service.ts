import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { JobQueueService } from './job-queue.service';
import { DocumentRepository } from '../database/repositories/document.repo';
import { CommentRepository } from '../database/repositories/comment.repo';
import { DocumentContentRepository } from '../database/repositories/document-content.repo';
import mongoose from 'mongoose';
import { SecurityLogger } from '../common/security-logger.service';

@Injectable()
export class MaintenanceService implements OnModuleInit {
  private readonly logger = new Logger(MaintenanceService.name);

  constructor(
    private readonly queue: JobQueueService,
    private readonly docs: DocumentRepository,
    private readonly contents: DocumentContentRepository,
    private readonly audit: SecurityLogger,
    private readonly comments: CommentRepository,
  ) {}

  onModuleInit() {
    this.queue.register('doc.cleanup.deleted', async () => this.cleanupDeleted());
    this.queue.register('orphan.cleanup', async () => this.cleanupOrphans());
    this.queue.register('index.maintain', async () => this.syncIndexes());
    this.queue.register('cache.cleanup', async () => this.cleanupCache());
    this.queue.register('audit.rotate', async () => this.rotateAudit());
    this.queue.register('comments.archive', async () => this.archiveOldComments());
    this.queue.register('snapshot.retention', async () => this.snapshotRetention());

    // basic schedule (fallback for when no external scheduler): run periodic jobs
    setInterval(() => {
      void this.queue.add('doc.cleanup.deleted', {}, { attempts: 1 });
      void this.queue.add('orphan.cleanup', {}, { attempts: 1 });
      void this.queue.add('index.maintain', {}, { attempts: 1, delayMs: 2000 });
      void this.queue.add('audit.rotate', {}, { attempts: 1, delayMs: 3000 });
      void this.queue.add('comments.archive', {}, { attempts: 1, delayMs: 4000 });
      void this.queue.add('snapshot.retention', {}, { attempts: 1, delayMs: 5000 });
    }, 60_000);
  }

  async cleanupDeleted() {
    const ttlDays = parseInt(process.env.DOC_DELETE_TTL_DAYS || '30', 10);
    const cutoff = new Date(Date.now() - ttlDays * 24 * 3600 * 1000);
    const ids = await this.docs.listDeletedBefore(cutoff);
    if (ids.length === 0) return;
    await this.contents.deleteByDocumentIds(ids);
    await this.audit.log('doc.cleanup.deleted', { count: ids.length });
    this.logger.log(`Cleaned content for ${ids.length} deleted docs`);
  }

  async cleanupOrphans() {
    // aggregation to find content without a corresponding document
    const Model = this.contents.mongooseModel as mongoose.Model<any> | undefined;
    if (!Model) return; // skip if underlying model not accessible
    const orphans = await (Model as any).aggregate([
      {
        $lookup: { from: 'documents', localField: 'documentId', foreignField: '_id', as: 'doc' },
      },
      { $match: { doc: { $size: 0 } } },
      { $project: { _id: 1 } },
      { $limit: 1000 },
    ]).exec();
    const ids = orphans.map((o: any) => o._id);
    if (ids.length) await Model.deleteMany({ _id: { $in: ids } });
    await this.audit.log('doc.cleanup.orphans', { count: ids.length });
  }

  async syncIndexes() {
    const models = mongoose.connection.models;
    for (const name of Object.keys(models)) {
      try {
        await models[name].syncIndexes();
      } catch {}
    }
    await this.audit.log('db.index.sync', { ok: true });
  }

  async cleanupCache() {
    try {
      const client = (this.queue as any).redis.getClient();
      const keys = await client.keys('docs:ws:*');
      if (keys.length) await client.del(keys);
      await this.audit.log('cache.cleanup', { count: keys.length });
    } catch {}
  }

  async rotateAudit() {
    try {
      const client = (this.queue as any).redis.getClient();
      const max = parseInt(process.env.AUDIT_LOG_MAX || '10000', 10);
      await client.ltrim('audit-log', 0, Math.max(0, max - 1));
      await this.audit.log('audit.rotate', { max });
    } catch {}
  }

  async archiveOldComments() {
    try {
      const ttlDays = parseInt(process.env.COMMENT_ARCHIVE_DAYS || '90', 10);
      const cutoff = new Date(Date.now() - ttlDays * 24 * 3600 * 1000);
      // Archive only top-level resolved threads older than cutoff
      const Model: any = (this.comments as any).model || (this.comments as any).mongooseModel || null;
      const model = Model || (require('mongoose').connection.models['CommentDoc'] as any);
      if (!model) return;
      const res = await model.updateMany(
        { parentId: null, status: 'resolved', archivedAt: null, updatedAt: { $lte: cutoff } },
        { $set: { archivedAt: new Date() } },
      );
      await this.audit.log('comments.archive', { matched: res?.matchedCount ?? undefined, modified: res?.modifiedCount ?? undefined });
    } catch {}
  }

  async snapshotRetention() {
    try {
      const Snap = mongoose.connection.models['DocumentSnapshot'] as mongoose.Model<any> | undefined;
      if (!Snap) return;
      const agg = await (Snap as any)
        .aggregate([
          { $group: { _id: '$documentId', count: { $sum: 1 } } },
          { $match: { count: { $gt: parseInt(process.env.SNAPSHOT_KEEP_LAST || '20', 10) } } },
          { $limit: 200 },
        ])
        .exec();
      const keepLast = parseInt(process.env.SNAPSHOT_KEEP_LAST || '20', 10);
      const maxAgeDays = parseInt(process.env.SNAPSHOT_MAX_AGE_DAYS || '90', 10);
      const cutoff = new Date(Date.now() - maxAgeDays * 24 * 3600 * 1000);
      for (const row of agg) {
        const list = await (Snap as any)
          .find({ documentId: row._id })
          .sort({ seq: -1 })
          .select({ _id: 1, isMilestone: 1, createdAt: 1 })
          .lean()
          .exec();
        const toDelete: any[] = [];
        for (let i = keepLast; i < list.length; i++) {
          const s = list[i];
          if (!s.isMilestone && new Date(s.createdAt) < cutoff) toDelete.push(s._id);
        }
        if (toDelete.length) await (Snap as any).deleteMany({ _id: { $in: toDelete } }).exec();
        await this.audit.log('snapshot.retention', { documentId: String(row._id), deleted: toDelete.length });
      }
    } catch {}
  }
}
