import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type DocRole = 'owner' | 'editor' | 'viewer';

@Schema({ timestamps: true })
export class DocumentPermission {
  _id!: string;

  @Prop({ type: Types.ObjectId, ref: 'Document', index: true, required: true })
  documentId!: string;

  @Prop({ type: Types.ObjectId, ref: 'User', index: true, required: true })
  userId!: string;

  @Prop({ required: true, default: 'viewer' })
  role!: DocRole;
}

export type DocumentPermissionDocument = HydratedDocument<DocumentPermission>;
export const DocumentPermissionSchema = SchemaFactory.createForClass(DocumentPermission);
DocumentPermissionSchema.index({ documentId: 1, userId: 1 }, { unique: true });
