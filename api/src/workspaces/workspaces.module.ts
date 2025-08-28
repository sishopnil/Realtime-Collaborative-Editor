import { Module } from '@nestjs/common';
import { WorkspacesService } from './workspaces.service';
import { WorkspacesController } from './workspaces.controller';
import { WorkspaceGuard } from './workspace.guard';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [DatabaseModule],
  providers: [WorkspacesService, WorkspaceGuard],
  controllers: [WorkspacesController],
})
export class WorkspacesModule {}
