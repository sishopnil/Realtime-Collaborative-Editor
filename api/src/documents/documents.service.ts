import { Injectable, NotFoundException } from '@nestjs/common';
import { DocumentRepository } from '../database/repositories/document.repo';
import { CreateDocumentDto } from './dto/create-document.dto';
import { UpdateDocumentDto } from './dto/update-document.dto';
import { CacheService } from '../redis/cache.service';

@Injectable()
export class DocumentsService {
  constructor(
    private readonly docs: DocumentRepository,
    private readonly cache: CacheService,
  ) {}

  async create(input: CreateDocumentDto) {
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

  async list(workspaceId: string) {
    const key = `docs:ws:${workspaceId}`;
    const cached = await this.cache.getJson<any[]>(key);
    if (cached) return cached;
    const list = await this.docs.listByWorkspace(workspaceId);
    await this.cache.setJson(key, list, 30);
    return list;
  }

  async update(id: string, input: UpdateDocumentDto) {
    const doc = await this.docs.update(id, input);
    if (!doc) throw new NotFoundException('Document not found');
    await this.cache.del(`docs:ws:${(doc as any).workspaceId}`);
    return doc;
  }
}

