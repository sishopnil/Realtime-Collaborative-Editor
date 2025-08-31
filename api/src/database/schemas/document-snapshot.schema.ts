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
}

export type DocumentSnapshotDocument = HydratedDocument<DocumentSnapshot>;
export const DocumentSnapshotSchema = SchemaFactory.createForClass(DocumentSnapshot);
DocumentSnapshotSchema.index({ documentId: 1, seq: -1 });
try { (DocumentSnapshotSchema as any).index({ documentId: 'hashed' }); } catch {}

