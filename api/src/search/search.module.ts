import { Module } from '@nestjs/common';
import { SearchController } from './search.controller';
import { DatabaseModule } from '../database/database.module';
import { RedisModule } from '../redis/redis.module';
import { CommentsModule } from '../comments/comments.module';
import { DocumentsModule } from '../documents/documents.module';

@Module({
  imports: [DatabaseModule, RedisModule, CommentsModule, DocumentsModule],
  controllers: [SearchController],
})
export class SearchModule {}

