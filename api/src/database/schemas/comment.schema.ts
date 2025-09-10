import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type CommentStatus = 'open' | 'resolved' | 'closed';

@Schema({ timestamps: true })
export class CommentDoc {
  _id!: string;

  @Prop({ type: Types.ObjectId, ref: 'Document', required: true, index: true })
  documentId!: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  authorId!: string;

  @Prop({ type: Types.ObjectId, ref: 'CommentDoc', default: null, index: true })
  parentId?: string | null;

  @Prop({ type: Types.ObjectId, ref: 'CommentDoc', default: null, index: true })
  threadId?: string | null; // top-level thread id

  @Prop({ type: String, required: true })
  text!: string;

  @Prop({ type: String, default: 'open', index: true })
  status!: CommentStatus;

  @Prop({ type: [String], default: [] })
  tags!: string[];

  @Prop({ type: Number, default: 0 })
  priority!: number; // 0=normal, higher=important

  @Prop({ type: Date })
  resolvedAt?: Date;

  @Prop({ type: Date })
  deletedAt?: Date; // soft delete

  @Prop({ type: Object, default: null })
  anchor?: { from: number; to: number; vectorB64?: string } | null; // for thread root

  @Prop({ type: Object, default: {} })
  reactions?: Record<string, number>;

  // Advanced workflow fields
  @Prop({ type: String, default: 'pending', index: true })
  moderationStatus?: 'pending' | 'approved' | 'rejected';

  @Prop({ type: Types.ObjectId, ref: 'User', default: null, index: true })
  assigneeId?: string | null;

  @Prop({ type: Date, default: null })
  dueAt?: Date | null;

  @Prop({ type: Date, default: null })
  escalatedAt?: Date | null;

  @Prop({ type: Date, default: null, index: true })
  archivedAt?: Date | null;

  // Simple analytics fields (computed opportunistically)
  @Prop({ type: Number, default: null })
  sentiment?: number | null; // -1..1

  @Prop({ type: Number, default: null })
  quality?: number | null; // 0..100
}

export type CommentDocument = HydratedDocument<CommentDoc>;
export const CommentSchema = SchemaFactory.createForClass(CommentDoc);
CommentSchema.index({ documentId: 1, threadId: 1, createdAt: 1 });
CommentSchema.index({ documentId: 1, status: 1, priority: -1, updatedAt: -1 });
CommentSchema.index({ moderationStatus: 1, assigneeId: 1 });
try { (CommentSchema as any).index({ text: 'text' }); } catch {}
