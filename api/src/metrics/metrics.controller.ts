import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { RedisService } from '../redis/redis.service';

@ApiTags('metrics')
@Controller('api/metrics')
export class MetricsController {
  constructor(private readonly redis: RedisService) {}

  @Get()
  @ApiOperation({ summary: 'Core system counters' })
  async list() {
    const r = this.redis.getClient();
    const keys = [
      'jobs:processed',
      'jobs:failed',
      'metrics:presence:sent',
      'metrics:presence:dropped',
      'ws:connections:total',
      'metrics:comments:created',
      'metrics:comments:replied',
      'metrics:comments:resolved',
      'metrics:comments:deleted',
      'metrics:comments:reacted',
    ];
    const vals = await r.mget(keys);
    const out: Record<string, number> = {};
    keys.forEach((k, i) => (out[k] = Number(vals[i] || '0')));
    return out;
  }
}
