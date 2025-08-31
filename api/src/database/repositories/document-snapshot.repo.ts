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
}

