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

  async upsertState(documentId: string, state: Buffer, vector: Buffer) {
    return this.model
      .findOneAndUpdate(
        { documentId },
        { $set: { state, vector, updatedAt: new Date() } },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      )
      .exec();
  }
}

