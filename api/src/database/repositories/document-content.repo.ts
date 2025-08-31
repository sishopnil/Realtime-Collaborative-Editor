import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { DocumentContent } from '../schemas/document-content.schema';

@Injectable()
export class DocumentContentRepository {
  constructor(@InjectModel(DocumentContent.name) private readonly model: Model<DocumentContent>) {}

  findByDocumentId(documentId: string) {
    return this.model.findOne({ documentId }).exec();
  }

  async upsertState(documentId: string, state: Buffer, vector: Buffer, checksum?: string, session?: any) {
    return this.model
      .findOneAndUpdate(
        { documentId },
        { $set: { state, vector, checksum, updatedAt: new Date() } },
        { upsert: true, new: true, setDefaultsOnInsert: true, session },
      )
      .exec();
  }

  async deleteByDocumentIds(ids: string[]) {
    if (!ids.length) return { deletedCount: 0 } as any;
    return this.model.deleteMany({ documentId: { $in: ids } }).exec();
  }

  // Expose underlying model for maintenance tasks that need aggregation
  get mongooseModel() {
    return this.model;
  }
}
