import { RedisService } from '../redis/redis.service';

// Allow 10 messages per second per user or IP
export async function allowWsMessage(redis: RedisService, keyId: string): Promise<boolean> {
  const key = `ws:${keyId}:1s`;
  const client = redis.getClient();
  const val = await client.incr(key);
  if (val === 1) await client.expire(key, 1);
  return val <= parseInt(process.env.WS_MSGS_PER_SEC || '10', 10);
}

