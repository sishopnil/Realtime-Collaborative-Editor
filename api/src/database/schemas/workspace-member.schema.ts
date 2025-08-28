import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type WorkspaceRole = 'owner' | 'admin' | 'editor' | 'viewer';

@Schema({ timestamps: true })
export class WorkspaceMember {
  _id!: string;

  @Prop({ type: Types.ObjectId, ref: 'Workspace', index: true, required: true })
  workspaceId!: string;

  @Prop({ type: Types.ObjectId, ref: 'User', index: true, required: true })
  userId!: string;

  @Prop({ required: true, default: 'viewer' })
  role!: WorkspaceRole;
}

export type WorkspaceMemberDocument = HydratedDocument<WorkspaceMember>;
export const WorkspaceMemberSchema = SchemaFactory.createForClass(WorkspaceMember);
WorkspaceMemberSchema.index({ workspaceId: 1, userId: 1 }, { unique: true });
