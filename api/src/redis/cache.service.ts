import { Injectable } from '@nestjs/common';
import { RedisService } from './redis.service';

@Injectable()
export class CacheService {
  constructor(private readonly redis: RedisService) {}

  async getJson<T>(key: string): Promise<T | null> {
    const val = await this.redis.getClient().get(key);
    return val ? (JSON.parse(val) as T) : null;
  }

  async setJson(key: string, value: unknown, ttlSeconds = 60): Promise<void> {
    await this.redis.getClient().set(key, JSON.stringify(value), 'EX', ttlSeconds);
  }

  async del(key: string): Promise<void> {
    await this.redis.getClient().del(key);
  }
}

