import { Injectable } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';

export type FlagConfig = { key: string; enabled: boolean; rolloutPercent?: number; allowUsers?: string[] };
type FeatureStore = { flags: FlagConfig[] };

function hashToPercent(input: string): number {
  let h = 2166136261 >>> 0; // FNV-1a 32-bit
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h % 100 + 100) % 100; // 0..99
}

@Injectable()
export class FeaturesService {
  private readonly key = 'features:config';
  constructor(private readonly redis: RedisService) {}

  async getConfig(): Promise<FeatureStore> {
    try {
      const raw = await this.redis.getClient().get(this.key);
      return raw ? (JSON.parse(raw) as FeatureStore) : { flags: [] };
    } catch {
      return { flags: [] };
    }
  }

  async setConfig(store: FeatureStore) {
    await this.redis.getClient().set(this.key, JSON.stringify(store));
  }

  async evaluateForUser(userId: string | undefined): Promise<Record<string, boolean>> {
    const cfg = await this.getConfig();
    const out: Record<string, boolean> = {};
    for (const f of cfg.flags || []) {
      if (!f.enabled) {
        out[f.key] = false;
        continue;
      }
      if (f.allowUsers && userId && f.allowUsers.includes(userId)) {
        out[f.key] = true;
        continue;
      }
      const pct = Math.max(0, Math.min(100, Math.floor(f.rolloutPercent || 100)));
      if (pct >= 100) {
        out[f.key] = true;
      } else if (!userId) {
        out[f.key] = false;
      } else {
        const p = hashToPercent(`${f.key}:${userId}`);
        out[f.key] = p < pct;
      }
    }
    return out;
  }
}

