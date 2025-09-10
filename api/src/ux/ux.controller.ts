import { Body, Controller, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { RedisService } from '../redis/redis.service';

@ApiTags('ux')
@Controller('api/ux')
export class UxController {
  constructor(private readonly redis: RedisService) {}

  @Post('vitals')
  @ApiOperation({ summary: 'Ingest Core Web Vitals (LCP, FID, CLS)' })
  async vitals(@Body() body: { name: 'LCP' | 'FID' | 'CLS'; value: number }) {
    const name = String(body?.name || '').toUpperCase();
    const value = Number(body?.value || 0);
    const r = this.redis.getClient();
    const buckets: Record<string, number[]> = {
      LCP: [1000, 2500, 4000, 6000],
      FID: [100, 300, 1000],
      CLS: [10, 25, 100, 250], // value*1000
    };
    if (!['LCP', 'FID', 'CLS'].includes(name)) return { ok: false };
    const scaled = name === 'CLS' ? Math.round(value * 1000) : Math.round(value);
    try {
      await r.incr(`metrics:ux:${name}:count`);
      await r.incrbyfloat(`metrics:ux:${name}:sum`, value);
      for (const b of buckets[name]) if (scaled <= b) await r.incr(`metrics:ux:${name}:le:${b}`);
    } catch {}
    return { ok: true };
  }
}

