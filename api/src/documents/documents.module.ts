import { Module } from '@nestjs/common';
import { DocumentsService } from './documents.service';
import { DocumentsController } from './documents.controller';
import { WorkspaceGuard } from '../workspaces/workspace.guard';
import { DocumentGuard } from './document.guard';
import { DatabaseModule } from '../database/database.module';
import { SecurityLogger } from '../common/security-logger.service';

@Module({
  imports: [DatabaseModule],
  providers: [WorkspaceGuard, DocumentGuard, DocumentsService, SecurityLogger],
  controllers: [DocumentsController],
})
export class DocumentsModule {}
