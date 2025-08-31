import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

@Schema({ timestamps: true, collection: 'docupdates' })
export class DocumentUpdate {
  _id!: string;

  @Prop({ type: Types.ObjectId, ref: 'Document', index: true, required: true })
  documentId!: string;

  // monotonically increasing, matches Document.version at time of write
  @Prop({ type: Number, index: true, required: true })
  seq!: number;

  // gzipped Yjs update payload
  @Prop({ type: Buffer, required: true })
  update!: Buffer;

  // optional metadata
  @Prop({ type: Types.ObjectId, ref: 'User' })
  userId?: string;

  @Prop({ type: Number })
  sizeBytes?: number;
}

export type DocumentUpdateDocument = HydratedDocument<DocumentUpdate>;
export const DocumentUpdateSchema = SchemaFactory.createForClass(DocumentUpdate);
DocumentUpdateSchema.index({ documentId: 1, seq: 1 }, { unique: true });
DocumentUpdateSchema.index({ documentId: 1, createdAt: -1 });
// Optional hashed index to support sharding by documentId (ignored if unsupported)
try { (DocumentUpdateSchema as any).index({ documentId: 'hashed' }); } catch {}
