import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type NotificationType = 'mention' | 'comment' | 'reply';

@Schema({ timestamps: true })
export class NotificationDoc {
  _id!: string;

  @Prop({ type: Types.ObjectId, ref: 'User', index: true, required: true })
  userId!: string;

  @Prop({ type: String, required: true })
  type!: NotificationType;

  @Prop({ type: Types.ObjectId, ref: 'Document', index: true })
  documentId?: string;

  @Prop({ type: Types.ObjectId, ref: 'CommentDoc', index: true })
  commentId?: string;

  @Prop({ type: Types.ObjectId, ref: 'CommentDoc', index: true })
  threadId?: string;

  @Prop({ type: Object, default: {} })
  data?: any;

  @Prop({ type: Date })
  readAt?: Date;
}

export type NotificationDocument = HydratedDocument<NotificationDoc>;
export const NotificationSchema = SchemaFactory.createForClass(NotificationDoc);
NotificationSchema.index({ userId: 1, createdAt: -1 });

