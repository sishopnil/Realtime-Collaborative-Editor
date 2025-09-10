import { Injectable } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';

export type ChaosConfig = {
  enabled?: boolean;
  http?: {
    failureRate?: number; // 0..1
    minLatencyMs?: number;
    maxLatencyMs?: number;
    includePaths?: string[]; // regex strings
    excludePaths?: string[]; // regex strings
  };
  ws?: {
    disconnectRate?: number; // 0..1
    dropPresenceRate?: number; // 0..1
  };
};

@Injectable()
export class ChaosService {
  private cache?: { cfg: ChaosConfig; ts: number };
  constructor(private readonly redis: RedisService) {}

  async getConfig(): Promise<ChaosConfig> {
    const now = Date.now();
    if (this.cache && now - this.cache.ts < 3000) return this.cache.cfg;
    try {
      const raw = await this.redis.getClient().get('chaos:config');
      const cfg: ChaosConfig = raw ? JSON.parse(raw) : {};
      this.cache = { cfg, ts: now };
      return cfg;
    } catch {
      return {};
    }
  }

  async setConfig(cfg: ChaosConfig) {
    await this.redis.getClient().set('chaos:config', JSON.stringify(cfg), 'EX', 3600);
    this.cache = { cfg, ts: Date.now() };
  }
}

