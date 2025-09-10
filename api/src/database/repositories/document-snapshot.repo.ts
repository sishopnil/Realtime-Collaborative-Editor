import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { DocumentSnapshot } from '../schemas/document-snapshot.schema';

@Injectable()
export class DocumentSnapshotRepository {
  constructor(@InjectModel(DocumentSnapshot.name) private readonly model: Model<DocumentSnapshot>) {}

  async create(documentId: string, seq: number, state: Buffer, vector: Buffer, checksum?: string, session?: any) {
    return this.model.create([{ documentId, seq, state, vector, checksum }], { session }).then((a) => a[0]);
  }

  list(documentId: string, limit = 20) {
    return this.model.find({ documentId }).sort({ seq: -1 }).limit(limit).lean().exec();
  }

  findById(id: string) {
    return this.model.findById(id).exec();
  }

  async updateMeta(id: string, data: Partial<DocumentSnapshot>) {
    return this.model.findByIdAndUpdate(id, data, { new: true }).exec();
  }

  async latestByDocument(documentId: string) {
    return this.model.findOne({ documentId }).sort({ seq: -1 }).lean().exec();
  }

  async enforceRetention(documentId: string, keepLast = 20, maxAgeDays = 90) {
    const cutoff = new Date(Date.now() - maxAgeDays * 24 * 3600 * 1000);
    // delete non-milestone older than cutoff beyond keepLast
    const list = await this.model.find({ documentId }).sort({ seq: -1 }).select({ _id: 1, isMilestone: 1, createdAt: 1 }).lean().exec();
    const toDelete: string[] = [];
    let kept = 0;
    for (const s of list as any[]) {
      const isOld = new Date(s.createdAt).getTime() < cutoff.getTime();
      kept++;
      if (kept <= keepLast) continue;
      if (!s.isMilestone && isOld) toDelete.push(String(s._id));
    }
    if (toDelete.length) await this.model.deleteMany({ _id: { $in: toDelete } }).exec();
    return { deleted: toDelete.length };
  }
}
