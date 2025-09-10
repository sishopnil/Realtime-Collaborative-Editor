import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { WorkspaceMember } from '../schemas/workspace-member.schema';

@Injectable()
export class WorkspaceMemberRepository {
  constructor(@InjectModel(WorkspaceMember.name) private readonly model: Model<WorkspaceMember>) {}

  upsert(workspaceId: string, userId: string, role: string, session?: any) {
    return this.model
      .findOneAndUpdate(
        { workspaceId, userId },
        { $set: { role } },
        { upsert: true, new: true, setDefaultsOnInsert: true, session },
      )
      .exec();
  }

  listMembers(workspaceId: string) {
    return this.model.find({ workspaceId }).exec();
  }

  remove(workspaceId: string, userId: string): Promise<any> {
    return this.model.deleteOne({ workspaceId, userId }).exec();
  }

  findRole(workspaceId: string, userId: string) {
    return this.model.findOne({ workspaceId, userId }).exec();
  }

  listByUser(userId: string) {
    return this.model.find({ userId }).exec();
  }
}
