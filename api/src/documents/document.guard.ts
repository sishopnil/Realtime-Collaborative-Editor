import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { DocumentRepository } from '../database/repositories/document.repo';
import { WorkspaceMemberRepository } from '../database/repositories/workspace-member.repo';
import { DocumentPermissionRepository } from '../database/repositories/document-permission.repo';

export const DocumentRole = (role: 'viewer' | 'editor' | 'owner') =>
  SetMetadata('document:role', role);

const rank: Record<string, number> = { viewer: 1, editor: 2, owner: 3 };

@Injectable()
export class DocumentGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly docs: DocumentRepository,
    private readonly members: WorkspaceMemberRepository,
    private readonly perms: DocumentPermissionRepository,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request & { user?: any }>();
    const required = this.reflector.get<string>('document:role', context.getHandler()) || 'viewer';
    const userId = req.user?.id as string | undefined;
    if (!userId) throw new ForbiddenException('Not authenticated');

    const docId = (req.params as any)?.id || (req.params as any)?.documentId;
    if (!docId) return true; // For list/create guarded by workspace
    const doc = await this.docs.findById(docId);
    if (!doc) throw new ForbiddenException('Document not found');
    if ((doc as any).ownerId?.toString?.() === userId) return true;

    // Document-level permission
    const perm = await this.perms.find(docId, userId);
    if (perm && rank[(perm as any).role] >= rank[required]) return true;

    // Workspace membership inheritance
    const mem = await this.members.findRole((doc as any).workspaceId, userId);
    if (!mem) throw new ForbiddenException('Not a workspace member');
    // Map workspace roles to document roles: viewer->viewer, editor->editor, admin/owner->owner
    const wsRole = (mem as any).role as string;
    const mapped = wsRole === 'viewer' ? 'viewer' : wsRole === 'editor' ? 'editor' : 'owner';
    if (rank[mapped] >= rank[required]) return true;

    throw new ForbiddenException('Insufficient permissions');
  }
}
