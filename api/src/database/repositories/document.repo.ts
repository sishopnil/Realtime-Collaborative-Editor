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

  update(id: string, data: Partial<Document>) {
    return this.model.findByIdAndUpdate(id, data, { new: true }).exec();
  }

  countByWorkspace(workspaceId: string) {
    return this.model.countDocuments({ workspaceId, status: { $ne: 'deleted' } }).exec();
  }

  findById(id: string) {
    return this.model.findById(id).exec();
  }
}
