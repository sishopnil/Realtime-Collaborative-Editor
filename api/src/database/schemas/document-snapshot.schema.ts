import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

@Schema({ timestamps: true, collection: 'docsnapshots' })
export class DocumentSnapshot {
  _id!: string;

  @Prop({ type: Types.ObjectId, ref: 'Document', index: true, required: true })
  documentId!: string;

  // document version/seq at snapshot time
  @Prop({ type: Number, index: true, required: true })
  seq!: number;

  // gzipped merged update and vector
  @Prop({ type: Buffer, required: true })
  state!: Buffer;

  @Prop({ type: Buffer, required: true })
  vector!: Buffer;

  @Prop({ type: String })
  checksum?: string;

  // Version history metadata
  @Prop({ type: String, default: '' })
  label?: string;

  @Prop({ type: String, default: '' })
  description?: string;

  @Prop({ type: [String], default: [] })
  tags?: string[];

  @Prop({ type: String, default: '' })
  category?: string; // e.g., 'auto', 'milestone', 'manual'

  @Prop({ type: Boolean, default: false, index: true })
  isMilestone?: boolean;

  @Prop({ type: Types.ObjectId, ref: 'User', index: true })
  createdBy?: string;

  @Prop({ type: String, default: 'auto' })
  createdReason?: 'auto-interval' | 'auto-milestone' | 'manual' | 'maintenance';

  @Prop({ type: Number, default: null })
  intervalSec?: number | null;
}

export type DocumentSnapshotDocument = HydratedDocument<DocumentSnapshot>;
export const DocumentSnapshotSchema = SchemaFactory.createForClass(DocumentSnapshot);
DocumentSnapshotSchema.index({ documentId: 1, seq: -1 });
try { (DocumentSnapshotSchema as any).index({ documentId: 'hashed' }); } catch {}
try { (DocumentSnapshotSchema as any).index({ label: 'text', description: 'text', tags: 1 }); } catch {}
