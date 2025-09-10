import { Controller, Get, Query, UseGuards, Req, Post, Body } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '../auth/auth.guard';
import { DocumentRepository } from '../database/repositories/document.repo';
import { CommentRepository } from '../database/repositories/comment.repo';
import { DocumentSnapshotRepository } from '../database/repositories/document-snapshot.repo';
import { CacheService } from '../redis/cache.service';
import { RedisService } from '../redis/redis.service';

@ApiTags('search')
@Controller('api/search')
@UseGuards(AuthGuard)
@ApiBearerAuth()
export class SearchController {
  constructor(
    private readonly docs: DocumentRepository,
    private readonly comments: CommentRepository,
    private readonly snaps: DocumentSnapshotRepository,
    private readonly cache: CacheService,
    private readonly redis: RedisService,
  ) {}

  @Get('docs')
  @ApiOperation({ summary: 'Search documents' })
  async searchDocs(
    @Query('q') q?: string,
    @Query('workspaceId') workspaceId?: string,
    @Query('authorId') authorId?: string,
    @Query('tags') tagsCsv?: string,
    @Query('status') statusCsv?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('skip') skip?: string,
    @Query('limit') limit?: string,
    @Req() req?: any,
  ) {
    const tags = (tagsCsv || '')
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
    const status = (statusCsv || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean) as any[];
    const key = `search:docs:${q || ''}:${workspaceId || ''}:${authorId || ''}:${tags.join('|')}:${status.join('|')}:${from || ''}:${to || ''}:${skip || 0}:${limit || 20}`;
    const cached = await this.cache.getJson<any>(key);
    if (cached) return cached;
    const list = await this.docs.searchDocs({
      q,
      workspaceId,
      authorId,
      tags,
      status: status as any,
      dateFrom: from ? new Date(from) : undefined,
      dateTo: to ? new Date(to) : undefined,
      skip: parseInt(String(skip || '0'), 10) || 0,
      limit: parseInt(String(limit || '20'), 10) || 20,
    });
    const out = list.map((d: any) => ({
      id: d._id,
      title: d.title,
      tags: d.tags || [],
      workspaceId: d.workspaceId,
      ownerId: d.ownerId,
      status: d.status,
      updatedAt: d.updatedAt,
      score: (d as any).score,
      snippet: this.snippet(d.title, q),
    }));
    await this.cache.setJson(key, out, 30);
    await this.trackQuery(q, req?.user?.id);
    return out;
  }

  @Get('comments')
  @ApiOperation({ summary: 'Search in comments' })
  async searchComments(@Query('q') q?: string, @Query('documentId') documentId?: string, @Query('skip') skip?: string, @Query('limit') limit?: string, @Req() req?: any) {
    const key = `search:comments:${q || ''}:${documentId || ''}:${skip || 0}:${limit || 20}`;
    const cached = await this.cache.getJson<any>(key);
    if (cached) return cached;
    const list = await this.comments.search({ q, documentId, skip: parseInt(String(skip || '0'), 10) || 0, limit: parseInt(String(limit || '20'), 10) || 20 });
    const out = list.map((c: any) => ({ id: c._id, documentId: c.documentId, text: c.text, createdAt: c.createdAt, authorId: c.authorId, score: (c as any).score, snippet: this.snippet(c.text, q) }));
    await this.cache.setJson(key, out, 30);
    await this.trackQuery(q, req?.user?.id);
    return out;
  }

  @Get('versions')
  @ApiOperation({ summary: 'Search in version labels/descriptions/tags' })
  async searchVersions(@Query('q') q?: string, @Query('documentId') documentId?: string, @Query('limit') limit?: string) {
    const key = `search:versions:${q || ''}:${documentId || ''}:${limit || 20}`;
    const cached = await this.cache.getJson<any>(key);
    if (cached) return cached;
    const Model: any = (this.snaps as any).model || (this.snaps as any).mongooseModel || null;
    const model = Model || (require('mongoose').connection.models['DocumentSnapshot'] as any);
    const qy: any = {};
    if (documentId) qy.documentId = documentId;
    let rowsQuery = model.find(qy).sort({ createdAt: -1 }).select({ documentId: 1, label: 1, description: 1, tags: 1, createdAt: 1 }).lean();
    if (q) rowsQuery = model.find({ ...qy, $text: { $search: q } }).sort({ createdAt: -1 }).select({ documentId: 1, label: 1, description: 1, tags: 1 }).lean();
    const rows = await rowsQuery.limit(Math.max(1, Math.min(200, parseInt(String(limit || '20'), 10) || 20))).exec();
    const out = rows.map((r: any) => ({ id: r._id, documentId: r.documentId, label: r.label, snippet: this.snippet(r.description || '', q), tags: r.tags || [], createdAt: r.createdAt }));
    await this.cache.setJson(key, out, 30);
    return out;
  }

  @Get('suggest')
  @ApiOperation({ summary: 'Autocomplete suggestions for titles and tags' })
  async suggest(@Query('q') q?: string, @Query('workspaceId') workspaceId?: string) {
    const rx = q ? new RegExp(String(q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') : null;
    const rows = await this.docs
      .searchDocs({ q: undefined, workspaceId, limit: 50 })
      .then((arr: any[]) => arr.filter((d) => (rx ? rx.test(d.title) : true)));
    const titles = Array.from(new Set(rows.map((d: any) => d.title))).slice(0, 10);
    const tags = Array.from(new Set(rows.flatMap((d: any) => d.tags || []).filter((t: string) => (rx ? rx.test(t) : true)))).slice(0, 10);
    return { titles, tags };
  }

  @Get('related')
  @ApiOperation({ summary: 'Related documents by tags and recency' })
  async related(@Query('documentId') documentId: string) {
    const list = await this.docs.related(documentId, 10);
    return list.map((d: any) => ({ id: d._id, title: d.title, tags: d.tags || [], updatedAt: d.updatedAt }));
  }

  @Post('click')
  @ApiOperation({ summary: 'Track search result click-through' })
  async click(@Body() body: { type: 'doc' | 'comment' | 'version'; id: string }) {
    try {
      const r = this.redis.getClient();
      await r.incr('metrics:search:clicks');
      await r.incr(`search:clicks:${body.type}:${body.id}`);
    } catch {}
    return { ok: true };
  }

  private snippet(text: string, q?: string): string | undefined {
    if (!q) return undefined;
    const t = String(text || '');
    const idx = t.toLowerCase().indexOf(q.toLowerCase());
    if (idx < 0) return undefined;
    const start = Math.max(0, idx - 40);
    const end = Math.min(t.length, idx + q.length + 40);
    return (start > 0 ? '…' : '') + t.slice(start, end) + (end < t.length ? '…' : '');
  }

  private async trackQuery(q?: string, userId?: string) {
    if (!q) return;
    try {
      const r = this.redis.getClient();
      await r.incr('metrics:search:queries');
      await r.zincrby('search:terms', 1, q.toLowerCase());
      if (userId) await r.lpush(`search:user:${userId}`, q);
    } catch {}
  }
}

