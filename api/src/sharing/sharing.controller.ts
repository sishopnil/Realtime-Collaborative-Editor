import { BadRequestException, Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '../auth/auth.guard';
import { RedisService } from '../redis/redis.service';
import { SecurityLogger } from '../common/security-logger.service';
import { DocumentGuard, DocumentRole } from '../documents/document.guard';
import bcrypt from 'bcryptjs';

@ApiTags('sharing')
@Controller('api/sharing')
export class SharingController {
  constructor(private readonly redis: RedisService, private readonly audit: SecurityLogger) {}

  @Post('links')
  @UseGuards(AuthGuard, DocumentGuard)
  @ApiBearerAuth()
  @DocumentRole('editor')
  @ApiOperation({ summary: 'Create a time-limited share link with optional password' })
  async createLink(
    @Body() body: { documentId: string; role?: 'viewer' | 'editor'; expiresInSec?: number; password?: string; allowAnonymousComment?: boolean; allowedDomainsCsv?: string },
    @Req() req: any,
  ) {
    if (!body?.documentId) throw new BadRequestException('Missing documentId');
    const role = (body.role || 'viewer') as 'viewer' | 'editor';
    const expires = Math.max(60, Math.min(60 * 60 * 24 * 30, Number(body.expiresInSec || 60 * 60 * 24)));
    const token = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
    const payload: any = {
      documentId: String(body.documentId),
      role,
      allowAnonymousComment: !!body.allowAnonymousComment,
      allowedDomains: (body.allowedDomainsCsv || '')
        .split(',')
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean),
      createdBy: String(req.user?.id),
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + expires * 1000).toISOString(),
    };
    if (body.password) payload.passwordHash = await bcrypt.hash(body.password, 10);
    await this.redis.getClient().set(`share:link:${token}`, JSON.stringify(payload), 'EX', expires);
    try {
      await this.redis.getClient().incr('metrics:sharing:links');
      await this.audit.log('share.link.create', { documentId: body.documentId, role, expiresInSec: expires });
    } catch {}
    return { token, url: `${process.env.PUBLIC_WEB_BASE || ''}/share/${token}`, expiresInSec: expires };
  }

  @Get('resolve/:token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Resolve share token metadata (no password validation)' })
  async resolve(@Param('token') token: string) {
    const recRaw = await this.redis.getClient().get(`share:link:${token}`);
    if (!recRaw) throw new BadRequestException('Invalid or expired token');
    const rec = JSON.parse(recRaw);
    try { await this.redis.getClient().incr('metrics:sharing:views'); } catch {}
    return { token, documentId: rec.documentId, role: rec.role, expiresAt: rec.expiresAt, allowAnonymousComment: !!rec.allowAnonymousComment };
  }
}

