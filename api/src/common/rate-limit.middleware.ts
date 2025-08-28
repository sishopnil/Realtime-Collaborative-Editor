import { NextFunction, Request, Response } from 'express';
import { RedisService } from '../redis/redis.service';
import { SecurityLogger } from './security-logger.service';
import { containsProfanity } from './profanity';

type Window = { limit: number; windowSec: number };

function getIp(req: Request): string {
  return (
    ((req.headers['x-forwarded-for'] as string)?.split(',')[0] || req.socket.remoteAddress || '') + ''
  ).trim();
}

export function createRateLimitMiddleware(redis: RedisService, audit: SecurityLogger) {
  const docsWindow: Window = { limit: parseInt(process.env.RATE_DOCS_PER_MIN || '100', 10), windowSec: 60 };
  const defaultIpWindow: Window = {
    limit: parseInt(process.env.RATE_IP_PER_MIN_DEFAULT || '600', 10),
    windowSec: 60,
  };
  const defaultUserWindow: Window = {
    limit: parseInt(process.env.RATE_USER_PER_MIN_DEFAULT || '600', 10),
    windowSec: 60,
  };
  const commentWindow: Window = {
    limit: parseInt(process.env.COMMENT_RATE_PER_MIN || '10', 10),
    windowSec: 60,
  };
  const emergencyPerIp = parseInt(process.env.EMERGENCY_RATE_LIMIT_PER_IP || '0', 10);
  const mentionMax = parseInt(process.env.MENTION_MAX_PER_COMMENT || '5', 10);
  const adminEmails = (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  // Simple in-process per-IP concurrency control
  const inflight: Record<string, number> = Object.create(null);
  const maxConcurrentPerIp = parseInt(process.env.MAX_CONCURRENT_PER_IP || '20', 10);

  async function bump(key: string, windowSec: number): Promise<number> {
    const client = redis.getClient();
    const val = await client.incr(key);
    if (val === 1) await client.expire(key, windowSec);
    return val;
  }

  async function tooManyDistinctPaths(ip: string): Promise<boolean> {
    const key = `paths:${ip}`;
    const client = redis.getClient();
    await client.sadd(key, Date.now().toString());
    await client.expire(key, 60);
    const sz = await client.scard(key);
    return sz > parseInt(process.env.BOT_PATH_VARIETY_THRESHOLD || '60', 10);
  }

  return async function rateLimit(req: Request & { user?: any }, res: Response, next: NextFunction) {
    const ip = getIp(req);
    const userId = req.user?.id as string | undefined;
    const userEmail = req.user?.email as string | undefined;

    // Blocked IPs
    const blocked = await redis.getClient().get(`block:ip:${ip}`);
    if (blocked) {
      res.status(429).json({ error: 'Temporarily blocked' });
      return;
    }

    // Emergency global per-IP limit
    if (emergencyPerIp > 0) {
      const val = await bump(`rate:ip:${ip}:global`, 60);
      if (val > emergencyPerIp) {
        await audit.log('abuse.rate.emergency', { ip });
        res.setHeader('Retry-After', '60');
        res.status(429).json({ error: 'Too many requests' });
        return;
      }
    }

    // Concurrency throttle per IP
    inflight[ip] = (inflight[ip] || 0) + 1;
    if (inflight[ip] > maxConcurrentPerIp) {
      inflight[ip] -= 1;
      res.status(429).json({ error: 'Too many concurrent requests' });
      return;
    }

    res.on('finish', () => {
      inflight[ip] = Math.max(0, (inflight[ip] || 1) - 1);
    });

    // Admin bypass
    const isAdmin = !!(userEmail && adminEmails.includes(userEmail.toLowerCase()));
    if (!isAdmin) {
      // Baseline per-IP and per-user limits across API
      const ipCount = await bump(`rate:any:ip:${ip}`, defaultIpWindow.windowSec);
      if (ipCount > defaultIpWindow.limit) {
        await audit.log('abuse.rate.ip', { ip, path: req.path });
        res.setHeader('Retry-After', String(defaultIpWindow.windowSec));
        res.status(429).json({ error: 'Too many requests from this IP' });
        return;
      }
      if (userId) {
        const userCount = await bump(
          `rate:any:user:${userId}`,
          defaultUserWindow.windowSec,
        );
        if (userCount > defaultUserWindow.limit) {
          await audit.log('abuse.rate.user', { userId, path: req.path });
          res.setHeader('Retry-After', String(defaultUserWindow.windowSec));
          res.status(429).json({ error: 'Too many requests for user' });
          return;
        }
      }
      // Document operations per-user limit
      if (req.path.startsWith('/api/docs')) {
        const key = userId ? `rate:docs:user:${userId}` : `rate:docs:ip:${ip}`;
        const val = await bump(key, docsWindow.windowSec);
        if (val > docsWindow.limit) {
          await audit.log('abuse.rate.docs', { ip, userId, path: req.path });
          res.setHeader('Retry-After', String(docsWindow.windowSec));
          res.status(429).json({ error: 'Rate limit exceeded for documents' });
          // Auto-block if persistent
          const b = await bump(`abuse:ip:${ip}`, 600);
          if (b > 50) await redis.getClient().set(`block:ip:${ip}`, '1', 'EX', 900);
          return;
        }
      }

      // Comments flood prevention
      if (/\/comments(\/|$)/.test(req.path) && req.method === 'POST') {
        const key = userId ? `rate:comment:user:${userId}` : `rate:comment:ip:${ip}`;
        const val = await bump(key, commentWindow.windowSec);
        if (val > commentWindow.limit) {
          await audit.log('abuse.comment.flood', { ip, userId });
          res.status(429).json({ error: 'Too many comments' });
          const b = await bump(`abuse:ip:${ip}`, 600);
          if (b > 20) await redis.getClient().set(`block:ip:${ip}`, '1', 'EX', 900);
          return;
        }
        // Mention spam protection
        const text = (req.body && (req.body.comment || req.body.text || req.body.content)) as string | undefined;
        if (text) {
          const mentions = new Set((text.match(/@([a-zA-Z0-9_\-.]+)/g) || []).map((m) => m.toLowerCase()));
          if (mentions.size > mentionMax) {
            await audit.log('abuse.comment.mentions', { ip, userId, count: mentions.size });
            res.status(400).json({ error: 'Too many mentions in a single comment' });
            return;
          }
          if (containsProfanity(text)) {
            await audit.log('abuse.comment.profanity', { ip, userId });
            res.status(400).json({ error: 'Profanity is not allowed' });
            return;
          }
        }
      }
    }

    // Basic bot detection: too many distinct paths
    if (await tooManyDistinctPaths(ip)) {
      await audit.log('abuse.bot.pattern', { ip });
      await redis.getClient().set(`block:ip:${ip}`, '1', 'EX', 600);
      res.status(429).json({ error: 'Blocked due to suspicious activity' });
      return;
    }

    next();
  };
}
