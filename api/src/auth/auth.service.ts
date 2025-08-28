import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UserRepository } from '../database/repositories/user.repo';
import * as bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { CacheService } from '../redis/cache.service';
import { RedisService } from '../redis/redis.service';
import { randomBytes, randomUUID } from 'crypto';
import { JwtKeysService } from '../security/jwt-keys.service';

type TokenPair = { accessToken: string; refreshToken: string; refreshId: string };

@Injectable()
export class AuthService {
  private readonly accessTtlSec = parseInt(process.env.JWT_ACCESS_TTL || '900', 10); // 15m
  private readonly refreshTtlSec = parseInt(process.env.JWT_REFRESH_TTL || '604800', 10); // 7d
  private readonly issuer = 'rce-api';

  constructor(
    private readonly users: UserRepository,
    private readonly cache: CacheService,
    private readonly redis: RedisService,
    private readonly keys: JwtKeysService,
  ) {}

  async validateUser(email: string, password: string) {
    const user = await this.users.findByEmail(email.toLowerCase().trim());
    if (!user) throw new UnauthorizedException('Invalid credentials');
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) throw new UnauthorizedException('Invalid credentials');
    return user;
  }

  async generateTokenPair(
    userId: string,
    opts?: { refreshTtlSec?: number; ip?: string | undefined; ua?: string | undefined },
  ): Promise<TokenPair> {
    const now = Math.floor(Date.now() / 1000);
    const accessToken = await this.keys.sign({ iat: now }, userId, this.accessTtlSec, 'rce-web', this.issuer);
    const jti = randomUUID();
    const refreshToken = await this.keys.sign(
      { iat: now, type: 'refresh', jti },
      userId,
      opts?.refreshTtlSec ?? this.refreshTtlSec,
      'rce-web',
      this.issuer,
    );
    const ttl = opts?.refreshTtlSec ?? this.refreshTtlSec;
    await this.cache.setJson(this.refreshKey(jti), { userId, jti }, ttl);
    // Track session metadata
    const meta = {
      userId,
      jti,
      ip: opts?.ip,
      ua: opts?.ua,
      createdAt: Date.now(),
      lastRotatedAt: Date.now(),
    };
    await this.cache.setJson(this.sessionKey(jti), meta, ttl);
    const client = this.redis.getClient();
    await client.sadd(this.userSessionsKey(userId), jti);
    await client.expire(this.userSessionsKey(userId), ttl);
    return { accessToken, refreshToken, refreshId: jti };
  }

  async rotateRefreshToken(
    oldToken: string,
    opts?: { ip?: string; ua?: string },
  ): Promise<TokenPair> {
    const payload = (await this.keys.verify(oldToken)) as any;
    if (payload.type !== 'refresh' || !payload.jti)
      throw new UnauthorizedException('Invalid token');
    const key = this.refreshKey(payload.jti);
    const session = await this.cache.getJson<{ userId: string; jti: string }>(key);
    if (!session) throw new UnauthorizedException('Refresh expired');
    // Invalidate old
    await this.cache.del(key);
    await this.cache.del(this.sessionKey(payload.jti));
    const client = this.redis.getClient();
    await client.srem(this.userSessionsKey(payload.sub as string), payload.jti);
    // Generate new pair
    return this.generateTokenPair(payload.sub as string, { ip: opts?.ip, ua: opts?.ua });
  }

  async revokeRefresh(jti: string) {
    await this.cache.del(this.refreshKey(jti));
    const session = await this.cache.getJson<{ userId: string }>(this.sessionKey(jti));
    await this.cache.del(this.sessionKey(jti));
    if (session?.userId) {
      const client = this.redis.getClient();
      await client.srem(this.userSessionsKey(session.userId), jti);
    }
  }

  async newEmailVerificationToken(userId: string): Promise<string> {
    const token = randomBytes(24).toString('hex');
    await this.cache.setJson(this.verifyKey(token), { userId }, 60 * 60 * 24); // 24h
    return token;
  }

  async consumeEmailVerificationToken(token: string): Promise<string | null> {
    const key = this.verifyKey(token);
    const data = await this.cache.getJson<{ userId: string }>(key);
    if (!data) return null;
    await this.cache.del(key);
    return data.userId;
  }

  async newPasswordResetToken(userId: string): Promise<string> {
    const token = randomBytes(24).toString('hex');
    await this.cache.setJson(this.resetKey(token), { userId }, 60 * 30); // 30m
    return token;
  }

  async consumePasswordResetToken(token: string): Promise<string | null> {
    const key = this.resetKey(token);
    const data = await this.cache.getJson<{ userId: string }>(key);
    if (!data) return null;
    await this.cache.del(key);
    return data.userId;
  }

  private refreshKey(jti: string) {
    return `refresh:${jti}`;
  }
  private sessionKey(jti: string) {
    return `session:${jti}`;
  }
  private userSessionsKey(userId: string) {
    return `user-sessions:${userId}`;
  }
  private verifyKey(token: string) {
    return `verify:${token}`;
  }
  private resetKey(token: string) {
    return `reset:${token}`;
  }
}
