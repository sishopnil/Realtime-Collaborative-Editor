import { Controller, Get, Post, Body, UseGuards, Req } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { NotificationRepository } from '../database/repositories/notification.repo';
import { RedisService } from '../redis/redis.service';

@Controller('notifications')
@UseGuards(AuthGuard)
export class NotificationsController {
  constructor(private readonly repo: NotificationRepository, private readonly redis: RedisService) {}

  @Get()
  list(@Req() req: any) {
    return this.repo.listByUser(String(req.user.id));
  }

  @Post('read')
  async read(@Req() req: any, @Body() body: any) {
    const ids = Array.isArray(body?.ids) ? body.ids : [];
    await this.repo.markRead(String(req.user.id), ids);
    return { ok: true };
  }

  @Get('prefs')
  async prefsGet(@Req() req: any) {
    const r = this.redis.getClient();
    const key = `notif:prefs:${req.user.id}`;
    const vals = await r.hgetall(key);
    return { web: vals.web !== '0', email: vals.email === '1', digest: vals.digest === '1' };
  }

  @Post('prefs')
  async prefsSet(@Req() req: any, @Body() body: any) {
    const r = this.redis.getClient();
    const key = `notif:prefs:${req.user.id}`;
    await r.hset(key, {
      web: body?.web ? '1' : '0',
      email: body?.email ? '1' : '0',
      digest: body?.digest ? '1' : '0',
    } as any);
    await r.expire(key, 60 * 60 * 24 * 365);
    return { ok: true };
  }
}

