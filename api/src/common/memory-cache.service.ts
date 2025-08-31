import { Injectable } from '@nestjs/common';

type Entry<T> = { value: T; expiresAt: number };

@Injectable()
export class MemoryCacheService {
  private store = new Map<string, Entry<any>>();
  private order: string[] = [];
  private max = parseInt(process.env.MEM_CACHE_MAX || '1000', 10);

  get<T>(key: string): T | null {
    const e = this.store.get(key);
    if (!e) return null;
    if (e.expiresAt < Date.now()) {
      this.del(key);
      return null;
    }
    return e.value as T;
  }

  set<T>(key: string, value: T, ttlSeconds = 10): void {
    const expiresAt = Date.now() + ttlSeconds * 1000;
    this.store.set(key, { value, expiresAt });
    this.order.push(key);
    if (this.store.size > this.max) this.evict();
  }

  del(key: string): void {
    this.store.delete(key);
  }

  private evict() {
    while (this.store.size > this.max && this.order.length) {
      const k = this.order.shift();
      if (k) this.store.delete(k);
    }
  }
}

