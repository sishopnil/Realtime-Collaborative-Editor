import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { NotificationDoc } from '../schemas/notification.schema';

@Injectable()
export class NotificationRepository {
  constructor(@InjectModel(NotificationDoc.name) private readonly model: Model<NotificationDoc>) {}

  create(data: Partial<NotificationDoc>) {
    return this.model.create(data);
  }

  listByUser(userId: string, limit = 50) {
    return this.model.find({ userId }).sort({ createdAt: -1 }).limit(limit).lean().exec();
  }

  markRead(userId: string, ids: string[]) {
    return this.model.updateMany({ userId, _id: { $in: ids } }, { $set: { readAt: new Date() as any } }).exec();
  }
}

