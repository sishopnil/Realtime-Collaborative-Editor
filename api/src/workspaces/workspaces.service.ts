import { Injectable, NotFoundException } from '@nestjs/common';
import { WorkspaceRepository } from '../database/repositories/workspace.repo';
import { WorkspaceMemberRepository } from '../database/repositories/workspace-member.repo';
import { CreateWorkspaceDto } from './dto/create-workspace.dto';
import { UpdateWorkspaceDto } from './dto/update-workspace.dto';
import { runWithTransaction } from '../database/transaction';

@Injectable()
export class WorkspacesService {
  constructor(
    private readonly workspaces: WorkspaceRepository,
    private readonly members: WorkspaceMemberRepository,
  ) {}

  async create(input: CreateWorkspaceDto) {
    return runWithTransaction(async (session) => {
      const created = await this.workspaces.createWithSession(
        { name: input.name, slug: input.slug, ownerId: input.ownerId },
        session,
      );
      await this.members.upsert((created as any)._id, input.ownerId, 'owner', session);
      return created;
    });
  }

  list(ownerId: string) {
    return this.workspaces.listByOwner(ownerId);
  }

  async update(id: string, input: UpdateWorkspaceDto) {
    const ws = await this.workspaces.update(id, input);
    if (!ws) throw new NotFoundException('Workspace not found');
    return ws;
  }

  get(id: string) {
    return this.workspaces.findById(id);
  }

  async remove(id: string) {
    const ws = await this.workspaces.findById(id);
    if (!ws) throw new NotFoundException('Workspace not found');
    // Soft delete could be added; for now, not implementing cascade.
    // Leaving as exercise; not deleting members to preserve audit.
    return this.workspaces.update(id, {
      slug: (ws as any).slug,
      name: (ws as any).name + ' (deleted)',
    } as any);
  }

  listMembers(workspaceId: string) {
    return this.members.listMembers(workspaceId);
  }

  addOrUpdateMember(workspaceId: string, userId: string, role: 'viewer' | 'editor' | 'admin') {
    return this.members.upsert(workspaceId, userId, role);
  }

  removeMember(workspaceId: string, userId: string): Promise<any> {
    return this.members.remove(workspaceId, userId);
  }
}
