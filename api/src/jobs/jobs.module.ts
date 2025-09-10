import { Module } from '@nestjs/common';
import { RedisModule } from '../redis/redis.module';
import { JobQueueService } from './job-queue.service';
import { DocumentJobsService } from './document-jobs.service';
import { MaintenanceService } from './maintenance.service';
import { JobsController } from './jobs.controller';
import { DatabaseModule } from '../database/database.module';
import { DocumentsModule } from '../documents/documents.module';
import { CommentsModule } from '../comments/comments.module';
import { SecurityLogger } from '../common/security-logger.service';

@Module({
  imports: [RedisModule, DatabaseModule, DocumentsModule, CommentsModule],
  providers: [JobQueueService, DocumentJobsService, MaintenanceService, SecurityLogger],
  controllers: [JobsController],
  exports: [JobQueueService],
})
export class JobsModule {}
