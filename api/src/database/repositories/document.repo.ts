import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Document } from '../schemas/document.schema';

@Injectable()
export class DocumentRepository {
  constructor(@InjectModel(Document.name) private readonly model: Model<Document>) {}

  create(data: Partial<Document>) {
    return this.model.create(data);
  }

  listByWorkspace(workspaceId: string, opts?: { q?: string; tag?: string }) {
    const q: any = { workspaceId, status: { $ne: 'deleted' } };
    if (opts?.q) {
      q.$or = [{ title: { $regex: opts.q, $options: 'i' } }, { tags: { $in: [opts.q] } }];
    }
    if (opts?.tag) q.tags = { $in: [opts.tag] };
    return this.model.find(q).sort({ updatedAt: -1 }).exec();
  }

  async searchDocs(opts: {
    q?: string;
    workspaceId?: string;
    authorId?: string;
    tags?: string[];
    status?: ('active' | 'archived')[];
    dateFrom?: Date;
    dateTo?: Date;
    limit?: number;
    skip?: number;
  }) {
    const q: any = { status: { $ne: 'deleted' } };
    if (opts.workspaceId) q.workspaceId = opts.workspaceId;
    if (opts.authorId) q.ownerId = opts.authorId;
    if (opts.tags?.length) q.tags = { $in: opts.tags };
    if (opts.status?.length) q.status = { $in: opts.status };
    if (opts.dateFrom || opts.dateTo) {
      q.updatedAt = {};
      if (opts.dateFrom) q.updatedAt.$gte = opts.dateFrom;
      if (opts.dateTo) q.updatedAt.$lte = opts.dateTo;
    }
    let query = this.model.find(q).lean();
    if (opts.q) {
      query = this.model
        .find({ ...q, $text: { $search: opts.q } })
        .select({ score: { $meta: 'textScore' }, title: 1, tags: 1, updatedAt: 1, ownerId: 1, workspaceId: 1, status: 1 })
        .sort({ score: { $meta: 'textScore' }, updatedAt: -1 })
        .lean();
    } else {
      query = this.model.find(q).sort({ updatedAt: -1 }).lean();
    }
    return query.skip(Math.max(0, opts.skip || 0)).limit(Math.max(1, Math.min(200, opts.limit || 20))).exec();
  }

  async related(documentId: string, limit = 10) {
    const doc = await this.model.findById(documentId).lean().exec();
    if (!doc) return [];
    const tags = (doc as any).tags || [];
    if (!tags.length) return this.model.find({ workspaceId: (doc as any).workspaceId, _id: { $ne: documentId }, status: { $ne: 'deleted' } }).sort({ updatedAt: -1 }).limit(limit).lean().exec();
    return this.model
      .find({ _id: { $ne: documentId }, status: { $ne: 'deleted' }, workspaceId: (doc as any).workspaceId, tags: { $in: tags } })
      .sort({ updatedAt: -1 })
      .limit(limit)
      .lean()
      .exec();
  }

  update(id: string, data: Partial<Document>) {
    return this.model.findByIdAndUpdate(id, data, { new: true }).exec();
  }

  incVersion(id: string, session?: any) {
    return this.model
      .findByIdAndUpdate(id, { $inc: { version: 1 } }, { new: true, session })
      .select({ version: 1, workspaceId: 1 })
      .exec();
  }

  countByWorkspace(workspaceId: string) {
    return this.model.countDocuments({ workspaceId, status: { $ne: 'deleted' } }).exec();
  }

  findById(id: string) {
    return this.model.findById(id).exec();
  }

  async listDeletedBefore(cutoff: Date): Promise<string[]> {
    const rows = await this.model
      .find({ status: 'deleted', deletedAt: { $lte: cutoff } })
      .select({ _id: 1 })
      .limit(1000)
      .lean()
      .exec();
    return rows.map((r: any) => r._id?.toString());
  }
}
