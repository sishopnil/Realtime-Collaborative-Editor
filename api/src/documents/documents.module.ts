import { Module } from '@nestjs/common';
import { DocumentsService } from './documents.service';
import { DocumentsController } from './documents.controller';
import { WorkspaceGuard } from '../workspaces/workspace.guard';
import { DocumentGuard } from './document.guard';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [DatabaseModule],
  providers: [WorkspaceGuard, DocumentGuard, DocumentsService],
  controllers: [DocumentsController],
})
export class DocumentsModule {}
