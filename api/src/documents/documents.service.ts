import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { DocumentRepository } from '../database/repositories/document.repo';
import { CreateDocumentDto } from './dto/create-document.dto';
import { UpdateDocumentDto } from './dto/update-document.dto';
import { CacheService } from '../redis/cache.service';
import { WorkspaceRepository } from '../database/repositories/workspace.repo';
import { DocumentPermissionRepository } from '../database/repositories/document-permission.repo';
import { UserRepository } from '../database/repositories/user.repo';

@Injectable()
export class DocumentsService {
  constructor(
    private readonly docs: DocumentRepository,
    private readonly cache: CacheService,
    private readonly workspacesRepo: WorkspaceRepository,
    private readonly perms: DocumentPermissionRepository,
    private readonly users: UserRepository,
  ) {}

  async create(input: CreateDocumentDto) {
    // enforce workspace document limits if configured
    const ws = await this.workspacesRepo.findById(input.workspaceId);
    const maxDocs = (ws as any)?.settings?.resourceLimits?.maxDocuments;
    if (maxDocs) {
      const count = await this.docs.countByWorkspace(input.workspaceId);
      if (count >= maxDocs) throw new ForbiddenException('Workspace document limit reached');
    }
    const doc = await this.docs.create({
      workspaceId: input.workspaceId,
      ownerId: input.ownerId,
      title: input.title,
      status: 'active',
      tags: [],
    });
    await this.cache.del(`docs:ws:${input.workspaceId}`);
    return doc;
  }

  async list(workspaceId: string, opts?: { q?: string; tag?: string }) {
    const key = `docs:ws:${workspaceId}`;
    if (!opts?.q && !opts?.tag) {
      const cached = await this.cache.getJson<any[]>(key);
      if (cached) return cached;
    }
    const list = await this.docs.listByWorkspace(workspaceId, opts);
    if (!opts?.q && !opts?.tag) await this.cache.setJson(key, list, 30);
    return list;
  }

  async update(id: string, input: UpdateDocumentDto) {
    const doc = await this.docs.update(id, input);
    if (!doc) throw new NotFoundException('Document not found');
    await this.cache.del(`docs:ws:${(doc as any).workspaceId}`);
    return doc;
  }

  async softDelete(id: string) {
    const doc = await this.docs.update(id, {
      status: 'deleted' as any,
      deletedAt: new Date() as any,
    });
    if (!doc) throw new NotFoundException('Document not found');
    await this.cache.del(`docs:ws:${(doc as any).workspaceId}`);
    return { ok: true };
  }

  listPermissions(documentId: string) {
    return this.perms.list(documentId);
  }

  async addPermission(
    documentId: string,
    body: { userId?: string; email?: string; role: 'viewer' | 'editor' },
  ) {
    let userId = body.userId;
    if (!userId && body.email) {
      const u = await this.users.findByEmail(body.email.toLowerCase().trim());
      if (!u) throw new NotFoundException('User not found');
      userId = (u as any)._id;
    }
    if (!userId) throw new NotFoundException('User not specified');
    return this.perms.upsert(documentId, userId, body.role);
  }

  removePermission(documentId: string, userId: string) {
    return this.perms.remove(documentId, userId);
  }
}
