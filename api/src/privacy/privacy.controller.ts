import { Body, Controller, HttpCode, HttpStatus, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '../auth/auth.guard';
import { Request } from 'express';
import { UserRepository } from '../database/repositories/user.repo';
import { WorkspaceRepository } from '../database/repositories/workspace.repo';
import { DocumentRepository } from '../database/repositories/document.repo';
import { WorkspaceMemberRepository } from '../database/repositories/workspace-member.repo';
import { DocumentPermissionRepository } from '../database/repositories/document-permission.repo';
import { RedisService } from '../redis/redis.service';

@ApiTags('privacy')
@Controller('api/privacy')
@UseGuards(AuthGuard)
@ApiBearerAuth()
export class PrivacyController {
  constructor(
    private readonly users: UserRepository,
    private readonly workspaces: WorkspaceRepository,
    private readonly documents: DocumentRepository,
    private readonly members: WorkspaceMemberRepository,
    private readonly perms: DocumentPermissionRepository,
    private readonly redis: RedisService,
  ) {}

  @Post('export')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Export user data (GDPR)' })
  async export(@Req() req: Request & { user?: any }) {
    const userId = req.user!.id;
    const user = await this.users.findById(userId);
    const owned = await this.workspaces.listByOwner(userId);
    const docs = await Promise.all(
      owned.map(async (ws: any) => ({ wsId: ws._id, docs: await this.documents.listByWorkspace(ws._id) })),
    );
    const memberships = await this.members.listByUser?.(userId);
    const sessions = await this.redis.getClient().smembers(`user-sessions:${userId}`);
    return { user, owned, documents: docs, memberships, sessions };
  }

  @Post('delete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request deletion/anonymization of user data' })
  async delete(@Req() req: Request & { user?: any }) {
    const userId = req.user!.id;
    // Anonymize user record
    const anonEmail = `deleted+${userId}@example.invalid`;
    await this.users.updateById(userId, {
      email: anonEmail as any,
      name: undefined as any,
      avatar: undefined as any,
      emailVerifiedAt: undefined as any,
    });
    // Remove memberships and document permissions
    const membs = (await this.members.listByUser?.(userId)) || [];
    for (const m of membs as any[]) await this.members.remove(m.workspaceId, userId);
    const dperms = (await this.perms.listByUser?.(userId)) || [];
    for (const p of dperms as any[]) await this.perms.remove(p.documentId, userId);
    // Revoke sessions
    const client = this.redis.getClient();
    const jtiss: string[] = await client.smembers(`user-sessions:${userId}`);
    for (const j of jtiss) await client.del(`session:${j}`);
    await client.del(`user-sessions:${userId}`);
    return { ok: true };
  }

  @Post('analytics')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Anonymized analytics view' })
  async analytics(@Req() req: Request & { user?: any }) {
    const userId = req.user!.id;
    const owned = await this.workspaces.listByOwner(userId);
    const docCounts = await Promise.all(
      (owned as any[]).map(async (w) => ({ wsId: w._id, count: await this.documents.countByWorkspace(w._id) })),
    );
    const memberships = await this.members.listByUser?.(userId);
    return {
      ownedCount: (owned as any[]).length,
      totalDocs: docCounts.reduce((a, b) => a + (b.count || 0), 0),
      membershipCount: (memberships as any[])?.length || 0,
    };
  }
}

