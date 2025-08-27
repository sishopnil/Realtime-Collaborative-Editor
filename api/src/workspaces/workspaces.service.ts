import { Injectable, NotFoundException } from '@nestjs/common';
import { WorkspaceRepository } from '../database/repositories/workspace.repo';
import { CreateWorkspaceDto } from './dto/create-workspace.dto';
import { UpdateWorkspaceDto } from './dto/update-workspace.dto';

@Injectable()
export class WorkspacesService {
  constructor(private readonly workspaces: WorkspaceRepository) {}

  create(input: CreateWorkspaceDto) {
    return this.workspaces.create(input);
  }

  list(ownerId: string) {
    return this.workspaces.listByOwner(ownerId);
  }

  async update(id: string, input: UpdateWorkspaceDto) {
    const ws = await this.workspaces.update(id, input);
    if (!ws) throw new NotFoundException('Workspace not found');
    return ws;
  }
}

