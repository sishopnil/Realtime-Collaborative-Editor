import { Controller, Get, Post, Body, Param, Query, Patch, Delete, BadRequestException, UseGuards, Req, ForbiddenException } from '@nestjs/common';
import { CommentRepository } from '../database/repositories/comment.repo';
import { AuthGuard } from '../auth/auth.guard';
import { UserRepository } from '../database/repositories/user.repo';
import { DocumentRepository } from '../database/repositories/document.repo';
import { DocumentPermissionRepository } from '../database/repositories/document-permission.repo';
import { WorkspaceMemberRepository } from '../database/repositories/workspace-member.repo';
import { NotificationRepository } from '../database/repositories/notification.repo';
import { RedisService } from '../redis/redis.service';
import { CacheService } from '../redis/cache.service';

@Controller('comments')
@UseGuards(AuthGuard)
export class CommentsController {
  constructor(
    private readonly repo: CommentRepository,
    private readonly users: UserRepository,
    private readonly docs: DocumentRepository,
    private readonly perms: DocumentPermissionRepository,
    private readonly members: WorkspaceMemberRepository,
    private readonly notifs: NotificationRepository,
    private readonly redis: RedisService,
    private readonly cache: CacheService,
  ) {}

  @Get('doc/:documentId')
  async list(
    @Param('documentId') documentId: string,
    @Query('status') status?: string,
    @Query('q') q?: string,
    @Query('skip') skip?: string,
    @Query('limit') limit?: string,
    @Query('fields') fields?: string,
  ) {
    const key = `comments:list:${documentId}:${status || ''}:${q || ''}:${skip || 0}:${limit || 50}:${fields || ''}`;
    const cached = await this.cache.getJson<any[]>(key);
    if (cached) return cached;
    const projection: Record<string, 0 | 1> | undefined = fields
      ? Object.fromEntries(
          fields
            .split(',')
            .map((f) => f.trim())
            .filter(Boolean)
            .map((f) => [f, 1] as const),
        )
      : undefined;
    const list = await this.repo.listThreads(documentId, {
      status,
      q,
      skip: parseInt(String(skip || '0'), 10) || 0,
      limit: parseInt(String(limit || '50'), 10) || 50,
      fields: projection,
    });
    await this.cache.setJson(key, list, 30);
    return list;
  }

  @Post()
  async create(@Body() body: any, @Req() req: any) {
    if (!body?.documentId || !body?.text) throw new BadRequestException('Missing fields');
    const isReply = !!body.parentId;
    const data: any = {
      documentId: String(body.documentId),
      authorId: this.resolveAuthorId(req),
      text: String(body.text),
      status: body.status || 'open',
      tags: body.tags || [],
      priority: body.priority || 0,
    };
    if (!isReply) {
      data.parentId = null;
      data.threadId = null;
      if (body.anchor && typeof body.anchor.from === 'number' && typeof body.anchor.to === 'number') {
        data.anchor = { from: Math.max(1, body.anchor.from | 0), to: Math.max(1, body.anchor.to | 0), vectorB64: body.anchor.vectorB64 };
      }
    } else {
      data.parentId = String(body.parentId);
      data.threadId = String(body.threadId || body.parentId);
    }
    const saved = await this.repo.create(data);
    try {
      // compute simple analytics
      const text = String(body.text || '');
      const sentiment = this.simpleSentiment(text);
      const quality = this.simpleQuality(text);
      await this.repo.update((saved as any)._id, { sentiment, quality } as any);
    } catch {}
    // @mentions parsing and notifications
    try {
      if (!req.user?.guest) {
        const mentions = await this.extractMentions(String(body.text || ''), String(body.documentId));
        for (const uid of mentions) {
          if (String(uid) === String(req.user?.id)) continue;
        await this.notifs.create({
          userId: uid,
          type: isReply ? ('reply' as any) : ('mention' as any),
          documentId: String(body.documentId),
          commentId: (saved as any)._id,
          threadId: (saved as any).threadId || (saved as any)._id,
          data: { by: req.user?.id, text: String(body.text || '').slice(0, 200) },
        });
        await this.publishNotify(uid, {
          type: isReply ? 'reply' : 'mention',
          documentId: String(body.documentId),
          commentId: (saved as any)._id,
          threadId: (saved as any).threadId || (saved as any)._id,
          text: String(body.text || '').slice(0, 120),
        });
        }
      }
    } catch {}
    try {
      await this.publishRoom(String(body.documentId), 'comment:created', { documentId: String(body.documentId), comment: saved });
      await this.publishIntegration('comment.created', { documentId: String(body.documentId), id: (saved as any)._id });
      await this.redis.getClient().incr('metrics:comments:created');
    } catch {}
    return saved;
  }

  @Post(':id/replies')
  async reply(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    if (!body?.text) throw new BadRequestException('Missing fields');
    const rec = await this.repo.create({
      documentId: String(body.documentId),
      authorId: this.resolveAuthorId(req),
      text: String(body.text),
      parentId: id,
      threadId: String(body.threadId || id),
      status: 'open',
    } as any);
    try {
      if (!req.user?.guest) {
        const mentions = await this.extractMentions(String(body.text || ''), String(body.documentId));
        for (const uid of mentions) {
          if (String(uid) === String(req.user?.id)) continue;
          await this.notifs.create({ userId: uid, type: 'reply' as any, documentId: String(body.documentId), commentId: (rec as any)._id, threadId: String(body.threadId || id), data: { by: req.user?.id, text: String(body.text || '').slice(0, 200) } });
          await this.publishNotify(uid, { type: 'reply', documentId: String(body.documentId), commentId: (rec as any)._id, threadId: String(body.threadId || id), text: String(body.text || '').slice(0, 120) });
        }
      }
    } catch {}
    try {
      await this.publishRoom(String(body.documentId), 'comment:created', { documentId: String(body.documentId), comment: rec });
      await this.publishIntegration('comment.reply', { documentId: String(body.documentId), id: (rec as any)._id, threadId: String(body.threadId || id) });
      await this.redis.getClient().incr('metrics:comments:replied');
    } catch {}
    return rec;
  }

  @Post(':id/resolve')
  async resolve(@Param('id') id: string) {
    const rec = await this.repo.update(id, { status: 'resolved' as any, resolvedAt: new Date() as any } as any);
    try {
      await this.publishRoom(String((rec as any)?.documentId || ''), 'comment:resolved', { documentId: String((rec as any)?.documentId || ''), id });
      await this.publishIntegration('comment.resolved', { documentId: String((rec as any)?.documentId || ''), id });
      await this.redis.getClient().incr('metrics:comments:resolved');
    } catch {}
    return rec;
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    const existing = await this.repo.findById(id);
    if (!existing) throw new BadRequestException('Not found');
    if (String((existing as any).authorId) !== String(req.user?.id)) throw new ForbiddenException('Not owner');
    const rec = await this.repo.update(id, body);
    try {
      await this.publishRoom(String((rec as any)?.documentId || ''), 'comment:updated', { documentId: String((rec as any)?.documentId || ''), comment: rec });
      await this.publishIntegration('comment.updated', { documentId: String((rec as any)?.documentId || ''), id });
    } catch {}
    return rec;
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @Req() req: any) {
    const existing = await this.repo.findById(id);
    if (!existing) throw new BadRequestException('Not found');
    if (String((existing as any).authorId) !== String(req.user?.id)) throw new ForbiddenException('Not owner');
    const rec = await this.repo.softDelete(id);
    try {
      await this.publishRoom(String((existing as any)?.documentId || ''), 'comment:deleted', { documentId: String((existing as any)?.documentId || ''), id });
      await this.publishIntegration('comment.deleted', { documentId: String((existing as any)?.documentId || ''), id });
      await this.redis.getClient().incr('metrics:comments:deleted');
    } catch {}
    return rec;
  }

  @Post(':id/anchor')
  updateAnchor(@Param('id') id: string, @Body() body: any) {
    if (!body?.from || !body?.to) throw new BadRequestException('Missing anchor');
    return this.repo.update(id, { anchor: { from: Math.max(1, body.from | 0), to: Math.max(1, body.to | 0), vectorB64: body.vectorB64 } } as any);
  }

  @Post(':id/react')
  async react(@Param('id') id: string, @Body() body: any) {
    const emoji = (body?.emoji || '👍').slice(0, 8);
    const rec = await this.repo.findById(id);
    if (!rec) throw new BadRequestException('Not found');
    const reactions = Object.assign({}, (rec as any).reactions || {});
    reactions[emoji] = (reactions[emoji] || 0) + 1;
    const updated = await this.repo.update(id, { reactions } as any);
    try {
      await this.publishRoom(String((rec as any)?.documentId || ''), 'comment:updated', { documentId: String((rec as any)?.documentId || ''), comment: updated });
      await this.publishIntegration('comment.reacted', { documentId: String((rec as any)?.documentId || ''), id, emoji });
      await this.redis.getClient().incr('metrics:comments:reacted');
    } catch {}
    return updated;
  }

  // Moderation & workflow endpoints
  @Post(':id/approve')
  async approve(@Param('id') id: string) {
    return this.repo.update(id, { moderationStatus: 'approved' } as any);
  }

  @Post(':id/reject')
  async reject(@Param('id') id: string) {
    return this.repo.update(id, { moderationStatus: 'rejected' } as any);
  }

  @Post(':id/assign')
  async assign(@Param('id') id: string, @Body() body: any) {
    if (!body?.assigneeId) throw new BadRequestException('Missing assigneeId');
    return this.repo.update(id, { assigneeId: String(body.assigneeId || ''), moderationStatus: 'approved' } as any);
  }

  @Post(':id/due')
  async due(@Param('id') id: string, @Body() body: any) {
    if (!body?.dueAt) throw new BadRequestException('Missing dueAt');
    const dueAt = new Date(body.dueAt);
    if (isNaN(dueAt.getTime())) throw new BadRequestException('Invalid dueAt');
    return this.repo.update(id, { dueAt } as any);
  }

  @Post(':id/escalate')
  async escalate(@Param('id') id: string) {
    const rec = await this.repo.findById(id);
    if (!rec) throw new BadRequestException('Not found');
    const priority = Math.min(10, ((rec as any).priority || 0) + 1);
    return this.repo.update(id, { priority, escalatedAt: new Date() } as any);
  }

  @Get('analytics/:documentId')
  async analytics(@Param('documentId') documentId: string) {
    const key = `comments:analytics:${documentId}`;
    const cached = await this.cache.getJson<any>(key);
    if (cached) return cached;
    const list = await this.repo.listByDoc(documentId);
    // compute stats
    const threads = list.filter((c: any) => !c.parentId);
    const replies = list.length - threads.length;
    const uniqueAuthors = new Set(list.map((c: any) => String(c.authorId))).size;
    const reactions = list.reduce((sum: number, c: any) => sum + Object.values(c.reactions || {}).reduce((a: number, b: any) => a + Number(b || 0), 0), 0);
    const byUser: Record<string, number> = {};
    for (const c of list as any[]) byUser[String(c.authorId)] = (byUser[String(c.authorId)] || 0) + 1;
    const topUsers = Object.entries(byUser)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([userId, count]) => ({ userId, count }));
    const now = Date.now();
    const days = 30;
    const activity = Array.from({ length: days }, (_, i) => {
      const dayStart = new Date(now - (days - 1 - i) * 24 * 3600 * 1000);
      const dayEnd = new Date(dayStart.getTime() + 24 * 3600 * 1000);
      const count = list.filter((c: any) => {
        const t = new Date(c.createdAt).getTime();
        return t >= dayStart.getTime() && t < dayEnd.getTime();
      }).length;
      return { date: dayStart.toISOString().slice(0, 10), count };
    });
    const sentiments = list.map((c: any) => typeof c.sentiment === 'number' ? c.sentiment : this.simpleSentiment(String(c.text || '')));
    const avgSentiment = sentiments.length ? sentiments.reduce((a, b) => a + b, 0) / sentiments.length : 0;
    const qualities = list.map((c: any) => typeof c.quality === 'number' ? c.quality : this.simpleQuality(String(c.text || '')));
    const avgQuality = qualities.length ? Math.round(qualities.reduce((a, b) => a + b, 0) / qualities.length) : 0;
    const result = {
      totals: { comments: list.length, threads: threads.length, replies, uniqueAuthors, reactions },
      activity,
      participation: { topUsers },
      sentiment: { avg: Number(avgSentiment.toFixed(3)) },
      quality: { avg: avgQuality },
    };
    await this.cache.setJson(key, result, 60);
    return result;
  }

  @Get('search')
  async search(@Query('documentId') documentId: string, @Query('q') q?: string, @Query('limit') limit?: string) {
    if (!documentId) throw new BadRequestException('Missing documentId');
    return this.repo.listThreads(documentId, { q, limit: parseInt(String(limit || '20'), 10) || 20 });
  }

  @Get('/mentions/search')
  async mentionSearch(@Query('q') q: string, @Query('documentId') documentId?: string) {
    const limit = 10;
    const list = await this.users.search(q || '', limit);
    if (!documentId) return list.map((u: any) => ({ id: u._id, email: u.email, name: u.name }));
    const allowed: any[] = [];
    for (const u of list as any[]) {
      const ok = await this.canAccessDoc(String(u._id), documentId);
      if (ok) allowed.push({ id: u._id, email: u.email, name: u.name });
    }
    return allowed;
  }

  private async publishNotify(userId: string, payload: any) {
    try {
      const r = this.redis.getClient();
      await r.publish('ws:notify', JSON.stringify({ to: String(userId), payload }));
    } catch {}
  }

  private async extractMentions(text: string, documentId: string): Promise<string[]> {
    const emails = new Set<string>();
    const re = /@([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text))) emails.add(m[1].toLowerCase());
    const users: any[] = [];
    for (const email of emails) {
      const u = await this.users.findByEmail(email);
      if (!u) continue;
      const ok = await this.canAccessDoc(String((u as any)._id), documentId);
      if (ok) users.push(String((u as any)._id));
    }
    return users;
  }

  private async canAccessDoc(userId: string, documentId: string) {
    try {
      const d = await this.docs.findById(documentId);
      if (!d) return false;
      if (String((d as any).ownerId) === userId) return true;
      const perm = await this.perms.find(documentId, userId);
      if (perm) return true;
      const mem = await this.members.findRole((d as any).workspaceId, userId);
      return !!mem;
    } catch { return false; }
  }

  private async publishRoom(documentId: string, type: string, payload: any) {
    if (!documentId) return;
    try {
      await this.redis.getClient().publish(`ws:room:${documentId}`, JSON.stringify({ documentId, type, payload }));
    } catch {}
  }

  private async publishIntegration(type: string, payload: any) {
    try {
      await this.redis.getClient().publish('integrations:comments', JSON.stringify({ type, payload }));
    } catch {}
  }

  private simpleSentiment(text: string): number {
    const pos = ['good', 'great', 'excellent', 'love', 'like', 'thanks', 'helpful', 'clear', 'nice', 'awesome'];
    const neg = ['bad', 'terrible', 'awful', 'hate', 'dislike', 'bug', 'broken', 'confusing', 'slow', 'issue'];
    const t = text.toLowerCase();
    let score = 0;
    for (const w of pos) if (t.includes(w)) score += 1;
    for (const w of neg) if (t.includes(w)) score -= 1;
    return Math.max(-1, Math.min(1, score / 3));
  }

  private simpleQuality(text: string): number {
    const len = Math.min(500, Math.max(0, text.trim().length));
    const hasLink = /(https?:\/\/|www\.)/i.test(text);
    const hasCode = /`{1,3}[^`]+`{1,3}/.test(text) || /```[\s\S]*?```/.test(text);
    const hasStructure = /[.!?]\s|\n/.test(text);
    let score = 40 + Math.round((len / 500) * 40);
    if (hasStructure) score += 5;
    if (hasLink) score += 5;
    if (hasCode) score += 5;
    return Math.max(0, Math.min(100, score));
  }

  private resolveAuthorId(req: any): string {
    if (!req?.user) return '';
    if (!req.user.guest) return String(req.user.id || '');
    const token = String(req.user?.share?.token || 'guest');
    let hex = Buffer.from(token).toString('hex');
    if (hex.length < 24) hex = (hex + '0'.repeat(24)).slice(0, 24);
    return hex.slice(0, 24);
  }
}
