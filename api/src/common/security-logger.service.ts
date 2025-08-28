import { Injectable } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class SecurityLogger {
  constructor(private readonly redis: RedisService) {}

  async log(event: string, details: Record<string, unknown>) {
    const entry = { ts: new Date().toISOString(), event, ...details };
    try {
      await this.redis.getClient().lpush('audit-log', JSON.stringify(entry));
      await this.redis.getClient().ltrim('audit-log', 0, 9999);
    } catch {}
    // Always also print to stdout for visibility
    console.log('[AUDIT]', JSON.stringify(entry));
  }
}
