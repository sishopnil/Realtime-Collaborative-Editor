import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { WorkspaceMemberRepository } from '../database/repositories/workspace-member.repo';

export const WorkspaceRole = (role: 'viewer' | 'editor' | 'admin' | 'owner') =>
  SetMetadata('workspace:role', role);

const rank: Record<string, number> = { viewer: 1, editor: 2, admin: 3, owner: 4 };

@Injectable()
export class WorkspaceGuard implements CanActivate {
  constructor(
    private readonly members: WorkspaceMemberRepository,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request & { user?: any }>();
    const required = this.reflector.get<string>('workspace:role', context.getHandler()) || 'viewer';
    const wsId =
      (req.params && (req.params as any)['workspaceId']) ||
      (req.body as any)?.workspaceId ||
      (req.query as any)?.workspaceId;
    if (!wsId) return true; // if route not tied to a workspace, allow
    const userId = req.user?.id;
    if (!userId) throw new ForbiddenException('Not authenticated');
    const member = await this.members.findRole(wsId as string, userId);
    if (!member) throw new ForbiddenException('Not a workspace member');
    const ok = rank[(member as any).role] >= rank[required];
    if (!ok) throw new ForbiddenException('Insufficient role');
    return true;
  }
}
