import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { DocumentUpdate } from '../schemas/document-update.schema';

@Injectable()
export class DocumentUpdateRepository {
  constructor(@InjectModel(DocumentUpdate.name) private readonly model: Model<DocumentUpdate>) {}

  async append(
    documentId: string,
    seq: number,
    update: Buffer,
    opts?: { userId?: string; sizeBytes?: number; session?: any },
  ) {
    return this.model
      .create([{ documentId, seq, update, userId: opts?.userId, sizeBytes: opts?.sizeBytes }], {
        session: (opts as any)?.session,
      })
      .then((arr) => arr[0]);
  }

  async countByDocument(documentId: string) {
    return this.model.countDocuments({ documentId }).exec();
  }

  async latestSeq(documentId: string) {
    const rec = await this.model.findOne({ documentId }).sort({ seq: -1 }).select({ seq: 1 }).exec();
    return rec?.seq ?? 0;
  }

  async compactUpTo(documentId: string, seqInclusive: number) {
    return this.model.deleteMany({ documentId, seq: { $lte: seqInclusive } }).exec();
  }

  async hotDocuments(minLatestSeq: number, limit = 100) {
    const rows = await this.model
      .aggregate([
        { $group: { _id: '$documentId', latest: { $max: '$seq' } } },
        { $match: { latest: { $gt: minLatestSeq } } },
        { $sort: { latest: -1 } },
        { $limit: limit },
      ])
      .exec();
    return rows.map((r: any) => ({ documentId: r._id?.toString(), latest: r.latest as number }));
  }

  async listAsc(documentId: string, afterSeq = 0, limit = 1000) {
    return this.model
      .find({ documentId, seq: { $gt: afterSeq } })
      .sort({ seq: 1 })
      .limit(limit)
      .lean()
      .exec();
  }
}
