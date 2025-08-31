import { Injectable } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class LockService {
  constructor(private readonly redis: RedisService) {}

  async acquire(key: string, ttlMs = 5000): Promise<string | null> {
    const token = Math.random().toString(36).slice(2);
    const ok = await this.redis.getClient().set(key, token, 'NX', 'PX', ttlMs);
    return ok ? token : null;
  }

  async release(key: string, token: string): Promise<void> {
    const client = this.redis.getClient();
    const lua = `
      if redis.call('get', KEYS[1]) == ARGV[1] then
        return redis.call('del', KEYS[1])
      else
        return 0
      end
    `;
    try {
      await (client as any).eval(lua, 1, key, token);
    } catch {}
  }
}

