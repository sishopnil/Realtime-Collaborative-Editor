import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Workspace } from '../schemas/workspace.schema';

@Injectable()
export class WorkspaceRepository {
  constructor(@InjectModel(Workspace.name) private readonly model: Model<Workspace>) {}

  create(data: Partial<Workspace>) {
    return this.model.create(data);
  }

  createWithSession(data: Partial<Workspace>, session: any) {
    return this.model.create([data], { session }).then((arr) => arr[0]);
  }

  listByOwner(ownerId: string) {
    return this.model.find({ ownerId }).sort({ createdAt: -1 }).exec();
  }

  findById(id: string) {
    return this.model.findById(id).exec();
  }

  update(id: string, data: Partial<Workspace>) {
    return this.model.findByIdAndUpdate(id, data, { new: true }).exec();
  }
}
