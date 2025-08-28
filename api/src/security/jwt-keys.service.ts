import { Injectable, OnModuleInit } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';
import { randomBytes } from 'crypto';
import jwt from 'jsonwebtoken';
import { SecretsService } from '../secrets/secrets.service';

type KeyRecord = { secret: string; createdAt: number };
type KeyStore = { currentKid: string; keys: Record<string, KeyRecord> };

@Injectable()
export class JwtKeysService implements OnModuleInit {
  private readonly ns = 'jwt:keys';
  private readonly rotateDays = parseInt(process.env.JWT_ROTATE_DAYS || '30', 10);
  private rotationTimer?: NodeJS.Timeout;

  constructor(private readonly redis: RedisService, private readonly secrets: SecretsService) {}

  async onModuleInit() {
    await this.ensureInitialized();
    // periodic rotation check daily
    this.rotationTimer = setInterval(() => this.ensureRotation().catch(() => {}), 24 * 60 * 60 * 1000);
  }

  private async load(): Promise<KeyStore> {
    const raw = await this.redis.getClient().get(this.ns);
    if (raw) return JSON.parse(raw) as KeyStore;
    return { currentKid: '', keys: {} };
  }

  private async save(store: KeyStore) {
    await this.redis.getClient().set(this.ns, JSON.stringify(store));
  }

  private newSecret(): string {
    return randomBytes(48).toString('base64url');
  }

  private now(): number {
    return Math.floor(Date.now() / 1000);
  }

  async ensureInitialized(): Promise<void> {
    const store = await this.load();
    if (!store.currentKid) {
      // seed from env if provided
      const bootstrap = (await this.secrets.get('JWT_SECRET')) || this.newSecret();
      const kid = 'k1';
      store.currentKid = kid;
      store.keys[kid] = { secret: bootstrap, createdAt: this.now() };
      await this.save(store);
    }
  }

  async ensureRotation(): Promise<void> {
    const store = await this.load();
    const curr = store.keys[store.currentKid];
    if (!curr) return this.ensureInitialized();
    const ageDays = (this.now() - curr.createdAt) / (60 * 60 * 24);
    if (ageDays >= this.rotateDays) {
      const kid = 'k' + (Object.keys(store.keys).length + 1);
      store.keys[kid] = { secret: this.newSecret(), createdAt: this.now() };
      store.currentKid = kid;
      // prune very old keys (older than 3x rotation period)
      const cutoff = this.now() - this.rotateDays * 3 * 24 * 60 * 60;
      for (const [id, rec] of Object.entries(store.keys)) {
        if (rec.createdAt < cutoff) delete store.keys[id];
      }
      await this.save(store);
    }
  }

  async getCurrent(): Promise<{ kid: string; secret: string }> {
    await this.ensureRotation();
    const store = await this.load();
    return { kid: store.currentKid, secret: store.keys[store.currentKid].secret };
  }

  async getByKid(kid: string): Promise<string | undefined> {
    const store = await this.load();
    return store.keys[kid]?.secret;
  }

  async sign(payload: object, subject: string, ttlSec: number, audience: string, issuer: string): Promise<string> {
    const { kid, secret } = await this.getCurrent();
    return jwt.sign(payload, secret, { subject, expiresIn: ttlSec, audience, issuer, header: { kid } });
  }

  async verify(token: string): Promise<any> {
    // Try to read kid from header; fallback to current
    const decoded = jwt.decode(token, { complete: true }) as any;
    const kid = decoded?.header?.kid as string | undefined;
    if (kid) {
      const secret = await this.getByKid(kid);
      if (secret) return jwt.verify(token, secret);
    }
    // fallback to current key
    const curr = await this.getCurrent();
    return jwt.verify(token, curr.secret);
  }
}

