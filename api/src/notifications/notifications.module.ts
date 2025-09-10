import { Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { NotificationDoc, NotificationSchema } from '../database/schemas/notification.schema';
import { NotificationRepository } from '../database/repositories/notification.repo';
import { RedisModule } from '../redis/redis.module';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: NotificationDoc.name, schema: NotificationSchema }]), 
    RedisModule,
    DatabaseModule,
  ],
  controllers: [NotificationsController],
  providers: [NotificationRepository],
  exports: [NotificationRepository],
})
export class NotificationsModule {}

