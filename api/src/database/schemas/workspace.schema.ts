import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { fieldEncryptionPlugin } from '../plugins/field-encryption.plugin';
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

  @Prop({ type: Object, default: {} })
  settings?: {
    description?: string;
    resourceLimits?: { maxDocuments?: number };
    defaultRole?: 'viewer' | 'editor' | 'admin';
  };
}

export type WorkspaceDocument = HydratedDocument<Workspace>;
export const WorkspaceSchema = SchemaFactory.createForClass(Workspace);
WorkspaceSchema.index({ slug: 1 }, { unique: true });
WorkspaceSchema.index({ ownerId: 1, createdAt: -1 });
// Encrypt potentially sensitive settings fields
WorkspaceSchema.plugin(fieldEncryptionPlugin as any, { fields: ['settings.description'] });
