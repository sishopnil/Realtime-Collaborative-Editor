import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { DocumentPermission } from '../schemas/document-permission.schema';

@Injectable()
export class DocumentPermissionRepository {
  constructor(
    @InjectModel(DocumentPermission.name) private readonly model: Model<DocumentPermission>,
  ) {}

  upsert(documentId: string, userId: string, role: string) {
    return this.model
      .findOneAndUpdate(
        { documentId, userId },
        { $set: { role } },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      )
      .exec();
  }

  list(documentId: string) {
    return this.model.find({ documentId }).exec();
  }

  remove(documentId: string, userId: string) {
    return this.model.deleteOne({ documentId, userId }).exec();
  }

  find(documentId: string, userId: string) {
    return this.model.findOne({ documentId, userId }).exec();
  }

  listByUser(userId: string) {
    return this.model.find({ userId }).exec();
  }
}
