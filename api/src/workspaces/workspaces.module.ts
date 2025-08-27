import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Workspace, WorkspaceSchema } from '../database/schemas/workspace.schema';
import { WorkspaceRepository } from '../database/repositories/workspace.repo';
import { WorkspacesService } from './workspaces.service';
import { WorkspacesController } from './workspaces.controller';

@Module({
  imports: [MongooseModule.forFeature([{ name: Workspace.name, schema: WorkspaceSchema }])],
  providers: [WorkspaceRepository, WorkspacesService],
  controllers: [WorkspacesController],
})
export class WorkspacesModule {}
