import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

@Schema({ timestamps: true })
export class Workspace {
  _id!: string;

  @Prop({ required: true })
  name!: string;

  @Prop({ required: true, unique: true, index: true, lowercase: true })
  slug!: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  ownerId!: string;
}

export type WorkspaceDocument = HydratedDocument<Workspace>;
export const WorkspaceSchema = SchemaFactory.createForClass(Workspace);
WorkspaceSchema.index({ slug: 1 }, { unique: true });
WorkspaceSchema.index({ ownerId: 1, createdAt: -1 });

