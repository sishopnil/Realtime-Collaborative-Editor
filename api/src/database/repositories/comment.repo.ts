import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, FilterQuery } from 'mongoose';
import { CommentDoc } from '../schemas/comment.schema';

@Injectable()
export class CommentRepository {
  constructor(@InjectModel(CommentDoc.name) private readonly model: Model<CommentDoc>) {}

  create(data: Partial<CommentDoc>) {
    return this.model.create(data);
  }

  async listThreads(
    documentId: string,
    opts?: { status?: string; q?: string; skip?: number; limit?: number; fields?: Record<string, 0 | 1> },
  ) {
    const q: FilterQuery<CommentDoc> = { documentId, parentId: null, deletedAt: { $exists: false } as any } as any;
    if (opts?.status) (q as any).status = opts.status;
    if (opts?.q) (q as any).$text = { $search: opts.q };
    const query = this.model
      .find(q)
      .sort({ priority: -1, updatedAt: -1 })
      .skip(Math.max(0, opts?.skip || 0))
      .limit(Math.max(0, Math.min(200, opts?.limit || 50)));
    if (opts?.fields) query.select(opts.fields);
    const threads = await query.lean().exec();
    const ids = threads.map((t: any) => t._id?.toString());
    const replies = await this.model.find({ threadId: { $in: ids }, deletedAt: { $exists: false } as any }).sort({ createdAt: 1 }).lean().exec();
    const grouped = new Map<string, any[]>();
    for (const r of replies as any[]) {
      const k = (r.threadId || '').toString();
      if (!grouped.has(k)) grouped.set(k, []);
      grouped.get(k)!.push(r);
    }
    return threads.map((t: any) => ({ ...t, replies: grouped.get(t._id.toString()) || [] }));
  }

  listByDoc(documentId: string) {
    return this.model
      .find({ documentId, deletedAt: { $exists: false } as any })
      .sort({ createdAt: 1 })
      .lean()
      .exec();
  }

  findById(id: string) {
    return this.model.findById(id).exec();
  }

  update(id: string, data: Partial<CommentDoc>) {
    return this.model.findByIdAndUpdate(id, data, { new: true }).exec();
  }

  softDelete(id: string) {
    return this.model.findByIdAndUpdate(id, { deletedAt: new Date() as any }, { new: true }).exec();
  }

  async search(opts: { q?: string; documentId?: string; workspaceId?: string; limit?: number; skip?: number }) {
    const q: FilterQuery<CommentDoc> = { deletedAt: { $exists: false } as any } as any;
    if (opts.documentId) (q as any).documentId = opts.documentId;
    // No workspaceId inside comments directly; join via document repo should be used at controller if needed
    let query = this.model.find(q).sort({ createdAt: -1 }).lean();
    if (opts.q) {
      query = this.model
        .find({ ...q, $text: { $search: opts.q } })
        .select({ score: { $meta: 'textScore' }, documentId: 1, text: 1, createdAt: 1, authorId: 1, threadId: 1 })
        .sort({ score: { $meta: 'textScore' }, createdAt: -1 })
        .lean();
    }
    return query.skip(Math.max(0, opts.skip || 0)).limit(Math.max(1, Math.min(200, opts.limit || 20))).exec();
  }
}
