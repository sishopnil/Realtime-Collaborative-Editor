import { Injectable } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class SecurityLogger {
  constructor(private readonly redis: RedisService) {}

  async log(event: string, details: Record<string, unknown>) {
    const entry = { ts: new Date().toISOString(), event, ...details } as any;
    const client = this.redis.getClient();
    const max = parseInt(process.env.AUDIT_LOG_MAX || '10000', 10);
    try {
      await client.lpush('audit-log', JSON.stringify(entry));
      await client.ltrim('audit-log', 0, Math.max(0, max - 1));
    } catch {}
    // Publish alerts for critical events
    if (this.isAlertEvent(event)) {
      try {
        await client.publish('security-alerts', JSON.stringify(entry));
        await client.lpush('security-alerts-recent', JSON.stringify(entry));
        await client.ltrim('security-alerts-recent', 0, 999);
      } catch {}
    }
    // Automated response to auth attacks: repeated login failures per email+ip
    if (event === 'auth.login.failed') {
      const key = `attack:login:${(details as any).email}:${(details as any).ip}`;
      const n = await client.incr(key);
      if (n === 1) await client.expire(key, 600);
      if (n > parseInt(process.env.AUTH_FAIL_BLOCK_THRESHOLD || '25', 10)) {
        await client.set(`block:ip:${(details as any).ip}`, '1', 'EX', 900);
        await this.safePublish({ event: 'auto.block', reason: 'auth.failed.threshold', ...details });
      }
    }
    console.log('[AUDIT]', JSON.stringify(entry));
  }

  private isAlertEvent(event: string): boolean {
    return (
      event.startsWith('abuse.') ||
      event.includes('lockout') ||
      event.includes('bot') ||
      event.includes('captcha')
    );
  }

  private async safePublish(entry: Record<string, unknown>) {
    try {
      await this.redis.getClient().publish('security-alerts', JSON.stringify(entry));
    } catch {}
  }
}
