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

  listByWorkspace(workspaceId: string) {
    return this.model.find({ workspaceId, status: { $ne: 'deleted' } }).sort({ updatedAt: -1 }).exec();
  }

  update(id: string, data: Partial<Document>) {
    return this.model.findByIdAndUpdate(id, data, { new: true }).exec();
  }
}

