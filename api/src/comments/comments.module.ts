import { Module } from '@nestjs/common';
import { CommentsController } from './comments.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { CommentDoc, CommentSchema } from '../database/schemas/comment.schema';
import { CommentRepository } from '../database/repositories/comment.repo';
import { DocumentsModule } from '../documents/documents.module';
import { DatabaseModule } from '../database/database.module';
import { RedisModule } from '../redis/redis.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [MongooseModule.forFeature([{ name: CommentDoc.name, schema: CommentSchema }]), DocumentsModule, DatabaseModule, RedisModule, NotificationsModule],
  controllers: [CommentsController],
  providers: [CommentRepository],
  exports: [CommentRepository],
})
export class CommentsModule {}
