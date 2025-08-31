import { Module } from '@nestjs/common';
import { DocumentsService } from './documents.service';
import { DocumentsController } from './documents.controller';
import { WorkspaceGuard } from '../workspaces/workspace.guard';
import { DocumentGuard } from './document.guard';
import { DatabaseModule } from '../database/database.module';
import { DocumentContentRepository } from '../database/repositories/document-content.repo';
import { SecurityLogger } from '../common/security-logger.service';
import { MemoryCacheService } from '../common/memory-cache.service';
import { LockService } from '../common/lock.service';
import { DocumentUpdateRepository } from '../database/repositories/document-update.repo';
import { DocumentSnapshotRepository } from '../database/repositories/document-snapshot.repo';

@Module({
  imports: [DatabaseModule],
  providers: [
    WorkspaceGuard,
    DocumentGuard,
    DocumentsService,
    SecurityLogger,
    DocumentContentRepository,
    LockService,
    DocumentUpdateRepository,
    DocumentSnapshotRepository,
    MemoryCacheService,
  ],
  controllers: [DocumentsController],
  exports: [DocumentsService, DocumentContentRepository],
})
export class DocumentsModule {}
