import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { fieldEncryptionPlugin } from '../plugins/field-encryption.plugin';
import { HydratedDocument } from 'mongoose';

@Schema({ timestamps: true })
export class User {
  _id!: string;

  @Prop({ required: true, unique: true, index: true, lowercase: true, trim: true })
  email!: string;

  @Prop({ required: true })
  passwordHash!: string;

  @Prop()
  name?: string;

  @Prop()
  avatar?: string;

  @Prop()
  emailVerifiedAt?: Date;
}

export type UserDocument = HydratedDocument<User>;
export const UserSchema = SchemaFactory.createForClass(User);
UserSchema.index({ email: 1 }, { unique: true });
// Encrypt sensitive PII (name) at rest
UserSchema.plugin(fieldEncryptionPlugin as any, { fields: ['name'] });
