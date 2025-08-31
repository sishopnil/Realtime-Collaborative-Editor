import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

@Schema({ timestamps: true })
export class Document {
  _id!: string;

  @Prop({ type: Types.ObjectId, ref: 'Workspace', required: true, index: true })
  workspaceId!: string;

  @Prop({ required: true })
  title!: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  ownerId!: string;

  @Prop({ type: [String], default: [] })
  tags!: string[];

  @Prop({ default: 'active', index: true })
  status!: 'active' | 'archived' | 'deleted';

  @Prop({ type: Date })
  deletedAt?: Date;

  // incremented on each persisted Yjs update
  @Prop({ type: Number, default: 0 })
  version!: number;
}

export type DocumentDocument = HydratedDocument<Document>;
export const DocumentSchema = SchemaFactory.createForClass(Document);
DocumentSchema.index({ workspaceId: 1, updatedAt: -1 });
DocumentSchema.index({ title: 'text', tags: 1 });
