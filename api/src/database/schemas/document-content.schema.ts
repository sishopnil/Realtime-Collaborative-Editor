import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

@Schema({ timestamps: true, collection: 'doccontents' })
export class DocumentContent {
  _id!: string;

  @Prop({ type: Types.ObjectId, ref: 'Document', unique: true, index: true, required: true })
  documentId!: string;

  // gzipped update (Uint8Array)
  @Prop({ type: Buffer, required: true })
  state!: Buffer;

  // yjs state vector (Uint8Array)
  @Prop({ type: Buffer, required: true })
  vector!: Buffer;
}

export type DocumentContentDocument = HydratedDocument<DocumentContent>;
export const DocumentContentSchema = SchemaFactory.createForClass(DocumentContent);
DocumentContentSchema.index({ documentId: 1 }, { unique: true });

